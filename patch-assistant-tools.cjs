const fs = require('fs');
let code = fs.readFileSync('js/lib/assistant-tools.js', 'utf8');

// 1. Add imports
const importsToAdd = `
import * as artifacts from './artifacts.js';
import { listJoinedSpaces, getJoinedSpace, SpaceEngine } from './space-engine.js';
import { getPublicProfiles } from './profile-system.js';
`;
code = code.replace(/import \{ fetchPackageMetadata \} from '\.\/npm-client\.js';/, "import { fetchPackageMetadata } from './npm-client.js';" + importsToAdd);

// 2. Add declarations
const declarationsToAdd = `,
  {
    name: 'list_saved_artifacts',
    description: 'List all saved files and artifacts in Toolbox (Files/Saved view).',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'read_artifact',
    description: 'Read the contents of a saved file or artifact by its ID.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: { type: 'STRING', description: 'The ID of the artifact to read.' }
      },
      required: ['id']
    }
  },
  {
    name: 'create_artifact',
    description: 'Create and save a new artifact/file.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Name of the artifact.' },
        kind: { type: 'STRING', description: 'Kind/type (e.g., text, code, md).' },
        text: { type: 'STRING', description: 'Content of the artifact.' }
      },
      required: ['name', 'text']
    }
  },
  {
    name: 'delete_artifact',
    description: 'Delete a saved artifact by ID.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: { type: 'STRING', description: 'The ID of the artifact to delete.' }
      },
      required: ['id']
    }
  },
  {
    name: 'list_conversations',
    description: 'List all active messaging spaces/conversations the user has joined.',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'read_space_messages',
    description: 'Read the latest messages from a messaging space conversation by space code.',
    parameters: {
      type: 'OBJECT',
      properties: {
        code: { type: 'STRING', description: 'The space code (e.g. QWEASD).' }
      },
      required: ['code']
    }
  },
  {
    name: 'send_space_message',
    description: 'Send a message into a messaging space conversation.',
    parameters: {
      type: 'OBJECT',
      properties: {
        code: { type: 'STRING', description: 'The space code.' },
        text: { type: 'STRING', description: 'The message text to send.' }
      },
      required: ['code', 'text']
    }
  },
  {
    name: 'list_profiles',
    description: 'List public user profiles for socializing.',
    parameters: { type: 'OBJECT', properties: {} }
  },`;

code = code.replace(/export const ASSISTANT_TOOL_DECLARATIONS = \[/, 'export const ASSISTANT_TOOL_DECLARATIONS = [' + declarationsToAdd);

// 3. Add cases
const casesToAdd = `
    case 'list_saved_artifacts': {
      try {
        const list = artifacts.list();
        return {
          status: 'success',
          type: 'artifacts-list',
          count: list.length,
          artifacts: list,
          message: \`Found \${list.length} saved artifact(s).\`
        };
      } catch (err) {
        return { status: 'error', success: false, message: \`Failed to list artifacts: \${err.message}\` };
      }
    }

    case 'read_artifact': {
      try {
        const file = artifacts.get(args.id);
        if (!file) return { status: 'error', success: false, message: \`Artifact \${args.id} not found.\` };
        return {
          status: 'success',
          type: 'artifact-content',
          id: file.id,
          name: file.name,
          content: file.text,
          message: \`Read artifact \${file.name} successfully.\`
        };
      } catch (err) {
        return { status: 'error', success: false, message: \`Failed to read artifact: \${err.message}\` };
      }
    }

    case 'create_artifact': {
      try {
        const file = artifacts.save({ name: args.name, kind: args.kind || 'text', text: args.text, from: 'Assistant' });
        return { status: 'success', id: file.id, message: \`Artifact \${file.name} created.\` };
      } catch (err) {
        return { status: 'error', success: false, message: \`Failed to create artifact: \${err.message}\` };
      }
    }

    case 'delete_artifact': {
      try {
        artifacts.remove(args.id);
        return { status: 'success', message: \`Artifact \${args.id} deleted.\` };
      } catch (err) {
        return { status: 'error', success: false, message: \`Failed to delete artifact: \${err.message}\` };
      }
    }

    case 'list_conversations': {
      try {
        const spaces = listJoinedSpaces();
        return {
          status: 'success',
          type: 'spaces-list',
          count: spaces.length,
          spaces: spaces,
          message: \`Found \${spaces.length} active conversation(s).\`
        };
      } catch (err) {
        return { status: 'error', success: false, message: \`Failed to list conversations: \${err.message}\` };
      }
    }

    case 'read_space_messages': {
      try {
        const engine = new SpaceEngine();
        await engine.join(args.code);
        
        await new Promise(r => setTimeout(r, 1000)); // wait for sync
        const msgs = engine.chat ? engine.chat.toArray() : [];
        const chatMsgs = msgs.slice(-50).map(m => \`[\${new Date(m.time).toLocaleTimeString()}] \${m.name}: \${m.text}\`);
        engine.leave();
        return {
          status: 'success',
          type: 'space-messages',
          count: chatMsgs.length,
          messages: chatMsgs,
          message: \`Read \${chatMsgs.length} messages from \${args.code}.\`
        };
      } catch (err) {
        return { status: 'error', success: false, message: \`Failed to read space: \${err.message}\` };
      }
    }

    case 'send_space_message': {
      try {
        const engine = new SpaceEngine();
        await engine.join(args.code);
        await new Promise(r => setTimeout(r, 1000)); // wait for sync
        engine.sendChat(args.text);
        engine.leave();
        return { status: 'success', message: \`Message sent to \${args.code}.\` };
      } catch (err) {
        return { status: 'error', success: false, message: \`Failed to send message: \${err.message}\` };
      }
    }

    case 'list_profiles': {
      try {
        const profiles = getPublicProfiles();
        return {
          status: 'success',
          type: 'profiles-list',
          count: profiles.length,
          profiles: profiles,
          message: \`Found \${profiles.length} profiles.\`
        };
      } catch (err) {
        return { status: 'error', success: false, message: \`Failed to list profiles: \${err.message}\` };
      }
    }
`;

code = code.replace(/default:\n\s*return \{ status: 'error'/, casesToAdd + '\n    default:\n        return { status: \'error\'');

fs.writeFileSync('js/lib/assistant-tools.js', code);
console.log('patched assistant-tools.js');
