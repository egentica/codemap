/**
 * Tool: codemap_routine_run
 * 
 * Execute a routine - displays checklist and runs all associated scripts.
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ── Input Schema ─────────────────────────────────────────────────────────────

export const inputSchema = z.object({
  name: z.string()
    .describe('Routine name to execute')
});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: ToolDefinition = {
  name: 'codemap_routine_run',
  description: 'Execute a routine - displays checklist and runs all associated scripts.',
  category: 'routine',
  tags: ['routine', 'run', 'workflow', 'execute']
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const routine = ctx.codemap.routines.get(args.name);
    
    if (!routine) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: {
              code: 'ROUTINE_NOT_FOUND',
              message: `Routine "${args.name}" not found.`
            }
          }, null, 2)
        }],
        isError: true
      };
    }
    
    // Display routine info
    let output = `# Routine: ${routine.name}\n${routine.description}\n\n`;
    
    if (routine.message) {
      output += `**Message:** ${routine.message}\n\n`;
    }
    
    if (routine.files.length > 0) {
      output += `## Referenced Files/Directories\n\n`;
      for (const file of routine.files) {
        output += `- ${file}\n`;
      }
      output += '\n';
    }
    
    if (routine.groups.length > 0) {
      output += `## Referenced Groups\n\n`;
      for (const group of routine.groups) {
        output += `- ${group}\n`;
      }
      output += '\n';
    }
    
    if (routine.checklist.length > 0) {
      output += `## Checklist\n\n`;
      
      // Group by priority
      const high = routine.checklist.filter((i) => i.priority === 'high');
      const medium = routine.checklist.filter((i) => i.priority === 'medium');
      const low = routine.checklist.filter((i) => i.priority === 'low');
      
      if (high.length > 0) {
        output += `**High Priority:**\n`;
        for (const item of high) {
          output += `- 🔴 ${item.text}\n`;
        }
        output += '\n';
      }
      
      if (medium.length > 0) {
        output += `**Medium Priority:**\n`;
        for (const item of medium) {
          output += `- 🟡 ${item.text}\n`;
        }
        output += '\n';
      }
      
      if (low.length > 0) {
        output += `**Low Priority:**\n`;
        for (const item of low) {
          output += `- 🟢 ${item.text}\n`;
        }
        output += '\n';
      }
    }
    
    // Execute scripts
    const scriptResults = [];
    
    if (routine.scripts.length > 0) {
      output += `## Executing Scripts (${routine.scripts.length})\n\n`;
      
      for (const script of routine.scripts) {
        try {
          const result = await ctx.codemap.scripts.execute(
            script.category,
            script.name,
            {
              host: ctx.codemap,
              iobus: ctx.codemap.io,
              eventBus: ctx.codemap['eventBus'],
              rootPath: ctx.rootPath,
              routineName: routine.name,
              routineDescription: routine.description
            } as any
          );
          
          scriptResults.push({
            script: `${script.category}/${script.name}`,
            success: true,
            result
          });
          
          output += `✓ ${script.category}/${script.name}\n`;
        } catch (error: any) {
          scriptResults.push({
            script: `${script.category}/${script.name}`,
            success: false,
            error: error.message
          });
          
          output += `✗ ${script.category}/${script.name}: ${error.message}\n`;
        }
      }
      output += '\n';
    }
    
    // Execute macros
    const macroResults = [];
    
    if (routine.macros.length > 0) {
      output += `## Executing Macros (${routine.macros.length})\n\n`;
      
      for (const macroName of routine.macros) {
        try {
          const macro = ctx.codemap.macros.get(macroName);
          
          if (!macro) {
            macroResults.push({
              macro: macroName,
              success: false,
              error: `Macro "${macroName}" not found`
            });
            output += `✗ ${macroName}: Macro not found\n`;
            continue;
          }
          
          const execOptions: any = {
            cwd: macro.cwd || ctx.rootPath,
            timeout: macro.timeout || 30000
          };
          if (macro.shell) {
            execOptions.shell = macro.shell;
          }
          if (macro.env) {
            execOptions.env = { ...process.env, ...macro.env };
          }
          
          try {
            const { stdout, stderr } = await execAsync(macro.cmd, execOptions);
            
            macroResults.push({
              macro: macroName,
              success: true,
              exitCode: 0,
              stdout,
              stderr
            });
            
            output += `✓ ${macroName}\n`;
          } catch (execError: any) {
            macroResults.push({
              macro: macroName,
              success: false,
              exitCode: execError.code || 1,
              stdout: execError.stdout || '',
              stderr: execError.stderr || '',
              error: execError.message
            });
            
            output += `✗ ${macroName}: Exit code ${execError.code || 1}\n`;
          }
        } catch (error: any) {
          macroResults.push({
            macro: macroName,
            success: false,
            error: error.message
          });
          
          output += `✗ ${macroName}: ${error.message}\n`;
        }
      }
      output += '\n';
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            routine: routine.name,
            message: routine.message,
            files: routine.files,
            groups: routine.groups,
            checklist: routine.checklist.map((i) => ({
              text: i.text,
              priority: i.priority
            })),
            scripts: scriptResults,
            macros: macroResults,
            formatted: output
          }
        }, null, 2)
      }]
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: {
            code: 'ROUTINE_RUN_FAILED',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
