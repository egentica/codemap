// tools/session/audit.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  verbose: z.boolean().optional().describe('Show all files checked (default: false)'),
  ruleId: z.string().optional().describe('Only run specific rule by ID')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_audit',
  description: 'Check for architecture violations based on .codemap/audit-rules.json. Supports file-location, forbidden-import, text-pattern, required-annotation, and script rules with exemptions via @codemap.audit.exempt annotations.',
  category: 'session',
  tags: ['session', 'audit', 'policy', 'architecture']
};

// ── Types ────────────────────────────────────────────────────────────────────
interface AuditRule {
  id: string;
  name: string;
  enabled: boolean;
  severity: 'error' | 'warning' | 'info';
  type: 'file-location' | 'forbidden-import' | 'text-pattern' | 'required-annotation' | 'script';
  description?: string;
  config: Record<string, any>;
}

interface AuditRulesConfig {
  version: string;
  rules: AuditRule[];
}

interface Violation {
  ruleId: string;
  ruleName: string;
  file: string;
  line?: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { verbose = false, ruleId } = args;
    
    // Load audit rules from .codemap/audit-rules.json
    const rulesPath = '.codemap/audit-rules.json';
    const resolved = await ctx.codemap.resolver.resolve(rulesPath);
    const rulesExist = await ctx.codemap.fs.exists(resolved.filePath);
    
    if (!rulesExist) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'No audit rules configured. Create .codemap/audit-rules.json to define project-specific rules.',
            hint: 'See .codemap/audit-rules.template.json for examples'
          }, null, 2)
        }]
      };
    }
    
    const rulesContent = await ctx.codemap.fs.read(resolved.filePath);
    const config: AuditRulesConfig = JSON.parse(rulesContent);
    
    // Filter rules
    let rules = config.rules.filter(r => r.enabled);
    if (ruleId) {
      rules = rules.filter(r => r.id === ruleId);
      if (rules.length === 0) {
        throw new Error(`Rule not found or disabled: ${ruleId}`);
      }
    }
    
    const violations: Violation[] = [];
    const allFiles = ctx.codemap.query['graph'].getAllFiles();
    const filesChecked: string[] = [];
    
    // Run each enabled rule
    for (const rule of rules) {
      const ruleViolations = await checkRule(rule, allFiles, ctx);
      violations.push(...ruleViolations);
    }
    
    // Track files checked
    for (const file of allFiles) {
      filesChecked.push(file.relativePath);
    }
    
    // Group violations by severity
    const errors = violations.filter(v => v.severity === 'error');
    const warnings = violations.filter(v => v.severity === 'warning');
    const infos = violations.filter(v => v.severity === 'info');
    
    const result: Record<string, unknown> = {
      success: true,
      rulesRun: rules.length,
      filesChecked: filesChecked.length,
      violationCount: violations.length,
      errorCount: errors.length,
      warningCount: warnings.length,
      infoCount: infos.length,
      violations: violations.length > 0 ? violations : undefined,
      clean: violations.length === 0,
      summary: violations.length === 0
        ? `✅ No violations (${rules.length} rules, ${filesChecked.length} files)`
        : `❌ ${violations.length} violation(s): ${errors.length} errors, ${warnings.length} warnings, ${infos.length} info`
    };
    
    if (verbose && violations.length === 0) {
      result.filesCheckedList = filesChecked;
      result.rulesChecked = rules.map(r => ({ id: r.id, name: r.name, type: r.type }));
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: {
            code: 'AUDIT_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};

// ── Rule Checkers ────────────────────────────────────────────────────────────
async function checkRule(
  rule: AuditRule,
  allFiles: any[],
  ctx: any
): Promise<Violation[]> {
  switch (rule.type) {
    case 'file-location':
      return checkFileLocation(rule, allFiles, ctx);
    case 'forbidden-import':
      return checkForbiddenImport(rule, allFiles, ctx);
    case 'text-pattern':
      return checkTextPattern(rule, allFiles, ctx);
    case 'required-annotation':
      return checkRequiredAnnotation(rule, allFiles, ctx);
    case 'script':
      return checkScript(rule, allFiles, ctx);
    default:
      return [];
  }
}

// Check if files matching pattern are in allowed paths
async function checkFileLocation(
  rule: AuditRule,
  allFiles: any[],
  _ctx: any
): Promise<Violation[]> {
  const { filePattern, allowedPaths, exemptAnnotation } = rule.config;
  const violations: Violation[] = [];
  
  for (const file of allFiles) {
    // Check if file matches pattern
    if (!matchesPattern(file.name, filePattern)) continue;
    
    // Check for exemption
    if (exemptAnnotation && hasExemption(file, exemptAnnotation)) continue;
    
    // Check if in allowed path
    const inAllowedPath = allowedPaths.some((path: string) =>
      file.relativePath.includes(path)
    );
    
    if (!inAllowedPath) {
      violations.push({
        ruleId: rule.id,
        ruleName: rule.name,
        file: file.relativePath,
        severity: rule.severity,
        message: `File "${file.name}" must be in: ${allowedPaths.join(', ')}`
      });
    }
  }
  
  return violations;
}

// Check for forbidden imports
async function checkForbiddenImport(
  rule: AuditRule,
  allFiles: any[],
  _ctx: any
): Promise<Violation[]> {
  const { imports, exemptFiles, exemptAnnotation } = rule.config;
  const violations: Violation[] = [];
  
  for (const file of allFiles) {
    // Check if file is exempt
    if (exemptFiles && exemptFiles.some((ef: string) => file.relativePath.includes(ef))) continue;
    if (exemptAnnotation && hasExemption(file, exemptAnnotation)) continue;
    
    // Check file references for forbidden imports
    for (const ref of file.references || []) {
      if (imports.includes(ref)) {
        violations.push({
          ruleId: rule.id,
          ruleName: rule.name,
          file: file.relativePath,
          severity: rule.severity,
          message: `Forbidden import: "${ref}"`
        });
      }
    }
  }
  
  return violations;
}

// Check for text patterns in files
async function checkTextPattern(
  rule: AuditRule,
  allFiles: any[],
  ctx: any
): Promise<Violation[]> {
  const { pattern, isRegex, allowedFiles, exemptAnnotation } = rule.config;
  const violations: Violation[] = [];
  const regex = isRegex ? new RegExp(pattern) : null;
  
  for (const file of allFiles) {
    // Check if file is allowed
    if (allowedFiles && allowedFiles.some((af: string) => file.relativePath.includes(af))) continue;
    if (exemptAnnotation && hasExemption(file, exemptAnnotation)) continue;
    
    // Read file content
    try {
      const resolved = await ctx.codemap.resolver.resolve(file.relativePath);
      const content = await ctx.codemap.fs.read(resolved.filePath);
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const matches = regex ? regex.test(line) : line.includes(pattern);
        
        if (matches) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            file: file.relativePath,
            line: i + 1,
            severity: rule.severity,
            message: `Pattern found: "${pattern}"`
          });
          break; // Only report once per file
        }
      }
    } catch (err) {
      // Skip files that can't be read
    }
  }
  
  return violations;
}

// Check for required annotations
async function checkRequiredAnnotation(
  rule: AuditRule,
  allFiles: any[],
  _ctx: any
): Promise<Violation[]> {
  const { filePattern, requiredAnnotations, requireAny, exemptAnnotation } = rule.config;
  const violations: Violation[] = [];
  
  for (const file of allFiles) {
    // Check if file matches pattern
    if (filePattern && !matchesGlob(file.relativePath, filePattern)) continue;
    if (exemptAnnotation && hasExemption(file, exemptAnnotation)) continue;
    
    const annotations = file.annotations || [];
    const annotationTypes = annotations.map((a: any) => `@codemap.${a.type}`);
    
    const hasRequired = requireAny
      ? requiredAnnotations.some((ra: string) => annotationTypes.includes(ra))
      : requiredAnnotations.every((ra: string) => annotationTypes.includes(ra));
    
    if (!hasRequired) {
      violations.push({
        ruleId: rule.id,
        ruleName: rule.name,
        file: file.relativePath,
        severity: rule.severity,
        message: requireAny
          ? `Missing any of: ${requiredAnnotations.join(', ')}`
          : `Missing required: ${requiredAnnotations.join(', ')}`
      });
    }
  }
  
  return violations;
}

// ── Helper Functions ─────────────────────────────────────────────────────────
function hasExemption(file: any, exemptAnnotation: string): boolean {
  const annotations = file.annotations || [];
  return annotations.some((a: any) =>
    a.type === 'note' && a.message.includes(exemptAnnotation)
  );
}

function matchesPattern(filename: string, pattern: string): boolean {
  const regex = new RegExp(pattern.replace(/\*/g, '.*'));
  return regex.test(filename);
}

function matchesGlob(path: string, pattern: string): boolean {
  const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
  return regex.test(path);
}

// Check using custom script
async function checkScript(
  rule: AuditRule,
  allFiles: any[],
  ctx: any
): Promise<Violation[]> {
  const { script: scriptPath } = rule.config;
  
  if (!scriptPath) {
    throw new Error(`Rule ${rule.id}: Missing 'script' in config`);
  }
  
  // Extract script name from path (e.g., "audit/api-versioning.js" -> "api-versioning")
  const scriptName = scriptPath.replace(/^audit\//, '').replace(/\.js$/, '');
  
  // Discover scripts
  await ctx.codemap.scripts.discover();
  
  // Check if script exists
  if (!ctx.codemap.scripts.has('audit', scriptName)) {
    throw new Error(`Rule ${rule.id}: Script not found: ${scriptPath}`);
  }
  
  // Prepare audit context
  const files = allFiles.map(f => ({
    path: f.relativePath,
    content: undefined, // Scripts can read files themselves if needed
    symbols: f.symbols || [],
    annotations: f.annotations || []
  }));
  
  const auditContext = {
    ruleId: rule.id,
    severity: rule.severity,
    files
  };
  
  // Execute script
  const result = await ctx.codemap.scripts.execute('audit', scriptName, auditContext);
  
  // Normalize result to Violation[]
  return normalizeAuditResult(result, rule);
}

// Normalize script result to Violation[]
function normalizeAuditResult(result: any, rule: AuditRule): Violation[] {
  // Boolean result: true = pass, false = fail
  if (typeof result === 'boolean') {
    return result ? [] : [{
      ruleId: rule.id,
      ruleName: rule.name,
      file: '<project>',
      severity: rule.severity,
      message: 'Script validation failed'
    }];
  }
  
  // Array result: assume array of violations
  if (Array.isArray(result)) {
    return result.map(v => ({
      ruleId: rule.id,
      ruleName: rule.name,
      file: v.file || '<unknown>',
      line: v.line,
      severity: rule.severity,
      message: v.message || 'Violation'
    }));
  }
  
  // Object result: { passed, violations }
  if (result && typeof result === 'object') {
    if (result.passed === true) {
      return [];
    }
    
    if (result.violations && Array.isArray(result.violations)) {
      return result.violations.map((v: any) => ({
        ruleId: rule.id,
        ruleName: rule.name,
        file: v.file || '<unknown>',
        line: v.line,
        severity: rule.severity,
        message: v.message || 'Violation'
      }));
    }
    
    // Fallback: treat as single violation
    return [{
      ruleId: rule.id,
      ruleName: rule.name,
      file: '<project>',
      severity: rule.severity,
      message: result.message || 'Script validation failed'
    }];
  }
  
  // Unknown result type
  return [];
}
