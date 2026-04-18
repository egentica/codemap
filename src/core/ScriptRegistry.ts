import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { FileSystemProvider } from '../types/contracts/FileSystemProvider.js';
import type { 
  ScriptCategory, 
  ScriptMetadata,
  ScriptContext
} from '../types/scripts.js';

export class ScriptRegistry {
  private rootPath: string;
  private provider: FileSystemProvider;
  private scripts: Map<string, ScriptMetadata> = new Map();
  private utilityScripts: Set<string> = new Set();
  
  constructor(rootPath: string, provider: FileSystemProvider) {
    this.rootPath = rootPath;
    this.provider = provider;
  }
  
  /**
   * Discover and validate all scripts
   */
  async discover(): Promise<void> {
    const scriptsDir = path.join(this.rootPath, '.codemap', 'scripts');
    
    const scriptsDirExists = await this.provider.exists(scriptsDir);
    if (!scriptsDirExists) {
      // Scripts directory doesn't exist - that's fine
      return;
    }
    
    const categories: ScriptCategory[] = ['audit', 'build', 'orient', 'close', 'utility'];
    
    for (const category of categories) {
      const categoryDir = path.join(scriptsDir, category);
      
      const categoryDirExists = await this.provider.exists(categoryDir);
      if (!categoryDirExists) {
        // Category directory doesn't exist - skip
        continue;
      }
      
      const files = await this.provider.readdir(categoryDir);
      
      for (const file of files) {
        if (!file.endsWith('.mjs')) continue;
        
        const scriptPath = path.join(categoryDir, file);
        const name = file.replace(/\.mjs$/, '');
        const key = `${category}:${name}`;
        
        // Validate script
        const metadata = await this.validateScript(category, name, scriptPath);
        this.scripts.set(key, metadata);
        
        // Track utility scripts for purging
        if (category === 'utility') {
          this.utilityScripts.add(key);
        }
      }
    }
  }
  
  /**
   * Validate a script by attempting to load it
   */
  private async validateScript(
    category: ScriptCategory,
    name: string,
    scriptPath: string
  ): Promise<ScriptMetadata> {
    try {
      // Dynamic import requires proper file URL
      const fileUrl = pathToFileURL(scriptPath).href;
      // Use Function constructor to prevent TypeScript from converting to require()
      const dynamicImport = new Function('specifier', 'return import(specifier)');
      const module = await dynamicImport(fileUrl);
      
      if (!module.default || typeof module.default.execute !== 'function') {
        throw new Error('Script must export default object with execute() method');
      }
      
      return {
        name,
        category,
        path: scriptPath,
        valid: true
      };
    } catch (error) {
      return {
        name,
        category,
        path: scriptPath,
        valid: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Get a script by category and name
   */
  get(category: ScriptCategory, name: string): ScriptMetadata | undefined {
    return this.scripts.get(`${category}:${name}`);
  }
  
  /**
   * Check if a script exists
   */
  has(category: ScriptCategory, name: string): boolean {
    return this.scripts.has(`${category}:${name}`);
  }
  
  /**
   * List all scripts, optionally filtered by category
   */
  list(category?: ScriptCategory): ScriptMetadata[] {
    const scripts = Array.from(this.scripts.values());
    if (category) {
      return scripts.filter(s => s.category === category);
    }
    return scripts;
  }
  
  /**
   * Create a new script with template
   */
  async create(category: ScriptCategory, name: string, template?: string): Promise<ScriptMetadata> {
    const scriptsDir = path.join(this.rootPath, '.codemap', 'scripts', category);
    await this.provider.mkdir(scriptsDir);
    
    const scriptPath = path.join(scriptsDir, `${name}.mjs`);
    
    // Check if script already exists
    const exists = await this.provider.exists(scriptPath);
    if (exists) {
      throw new Error(`Script ${category}/${name} already exists`);
    }
    
    // Generate template if not provided
    const content = template || this.generateTemplate(category, name);
    await this.provider.write(scriptPath, content);
    
    // Validate and register
    const metadata = await this.validateScript(category, name, scriptPath);
    this.scripts.set(`${category}:${name}`, metadata);
    
    if (category === 'utility') {
      this.utilityScripts.add(`${category}:${name}`);
    }
    
    return metadata;
  }
  
  /**
   * Delete a script
   */
  async delete(category: ScriptCategory, name: string): Promise<void> {
    const key = `${category}:${name}`;
    const metadata = this.scripts.get(key);
    
    if (!metadata) {
      throw new Error(`Script ${category}/${name} not found`);
    }
    
    await this.provider.remove(metadata.path);
    this.scripts.delete(key);
    this.utilityScripts.delete(key);
  }
  
  /**
   * Execute a script with context
   */
  async execute<T = any>(
    category: ScriptCategory,
    name: string,
    context: ScriptContext
  ): Promise<T> {
    const metadata = this.scripts.get(`${category}:${name}`);
    
    if (!metadata) {
      throw new Error(`Script ${category}/${name} not found`);
    }
    
    if (!metadata.valid) {
      throw new Error(`Script ${category}/${name} is invalid: ${metadata.error}`);
    }
    
    // Load script module
    const fileUrl = pathToFileURL(metadata.path).href;
    // Use Function constructor to prevent TypeScript from converting to require()
    const dynamicImport = new Function('specifier', 'return import(specifier)');
    const module = await dynamicImport(fileUrl);
    
    // Execute with context
    return await module.default.execute(context);
  }
  
  /**
   * Purge all utility scripts
   */
  async purgeUtilityScripts(): Promise<void> {
    const utilityKeys = Array.from(this.utilityScripts);
    
    for (const key of utilityKeys) {
      const metadata = this.scripts.get(key);
      if (!metadata) continue;
      
      try {
        await this.provider.remove(metadata.path);
        this.scripts.delete(key);
        this.utilityScripts.delete(key);
      } catch (error) {
        // Log but don't throw - best effort cleanup
        console.error(`Failed to purge utility script ${key}:`, error);
      }
    }
  }
  
  /**
   * Generate a template for a new script
   */
  private generateTemplate(category: ScriptCategory, name: string): string {
    const templates: Record<ScriptCategory, string> = {
      audit: `/**
 * Audit script: ${name}
 * 
 * Validates code against custom rules.
 * Returns violations or boolean pass/fail.
 */

export default {
  name: '${name}',
  
  async execute(context) {
    const { ruleId, files, severity } = context;
    const violations = [];
    
    // TODO: Implement validation logic
    for (const file of files) {
      // Example: Check for required annotations
      // if (!file.annotations?.some(a => a.text.includes('@required'))) {
      //   violations.push({
      //     file: file.path,
      //     message: 'Missing required annotation'
      //   });
      // }
    }
    
    return {
      passed: violations.length === 0,
      violations
    };
  }
};
`,
      build: `/**
 * Build script: ${name}
 * 
 * Executes build processes.
 * Returns success status and optional output.
 */

export default {
  name: '${name}',
  
  async execute(context) {
    const { host, rootPath, args } = context;
    
    try {
      // TODO: Implement build logic
      // Example: Run npm build
      // import { exec } from 'child_process';
      // const result = await new Promise((resolve, reject) => {
      //   exec('npm run build', { cwd: rootPath }, (err, stdout) => {
      //     if (err) reject(err);
      //     else resolve(stdout);
      //   });
      // });
      
      return {
        success: true,
        message: 'Build completed successfully'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};
`,
      orient: `/**
 * Orient script: ${name}
 * 
 * Contributes markdown content to orient output.
 * Returns markdown string to append.
 */

export default {
  name: '${name}',
  
  async execute(context) {
    const { host, sessionId } = context;
    
    // TODO: Generate orient contribution
    // Example: Show custom project stats
    // const stats = await host.getCustomStats();
    
    return \`
## Custom Section

Add your custom orient information here.

- Session: \${sessionId}
- Custom data: ...
\`;
  }
};
`,
      close: `/**
 * Close script: ${name}
 * 
 * Runs cleanup and validation during session close.
 * Returns success status and optional message.
 */

export default {
  name: '${name}',
  
  async execute(context) {
    const { host, sessionId, stats, summary } = context;
    
    try {
      // TODO: Implement close logic
      // Example: Backup session data, run final validation, etc.
      
      return {
        success: true,
        message: 'Close script completed'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};
`,
      utility: `/**
 * Utility script: ${name}
 * 
 * Ad-hoc helper script. No interface requirements.
 * EPHEMERAL: Purged on session close.
 */

export default {
  name: '${name}',
  
  async execute(context) {
    const { host, iobus, eventBus, rootPath } = context;
    
    // TODO: Implement utility logic
    
    return { success: true };
  }
};
`
    };
    
    return templates[category];
  }
}
