import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  WORKSPACE_EVENT_CONTRACT,
  WORKSPACE_EVENT_FIELD_TYPES,
} from './events-contract.js';
import * as constants from './constants.js';

const WORKSPACE_DIR = path.dirname(fileURLToPath(import.meta.url));

function collectWorkspaceEventLiterals() {
  const stack = [WORKSPACE_DIR];
  const events = new Set();
  const literalPattern = /['"]workspace:[a-z0-9-]+['"]/g;

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = readdirSync(current, { withFileTypes: true });

    entries.forEach((entry) => {
      const entryPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        stack.push(entryPath);
        return;
      }

      if (!entry.isFile() || !entry.name.endsWith('.js')) {
        return;
      }

      const source = readFileSync(entryPath, 'utf8');
      const matches = source.match(literalPattern);

      if (matches) {
        matches.forEach((match) => {
          events.add(match.slice(1, -1));
        });
      }
    });
  }

  return Array.from(events);
}

describe('workspace event contract', () => {
  it('covers every workspace:* event emitted in source code', () => {
    const contractEvents = Object.keys(WORKSPACE_EVENT_CONTRACT).sort();

    const literalEvents = collectWorkspaceEventLiterals();
    const constantEvents = Object.values(constants)
      .filter((value) => typeof value === 'string' && value.startsWith('workspace:'))
      .map((value) => value);

    const allEvents = Array.from(new Set([...literalEvents, ...constantEvents])).sort();

    expect(contractEvents).toEqual(allEvents);
  });

  it('uses a controlled set of field type identifiers', () => {
    expect(Object.isFrozen(WORKSPACE_EVENT_CONTRACT)).toBe(true);
    expect(Object.isFrozen(WORKSPACE_EVENT_FIELD_TYPES)).toBe(true);
    const uniqueTypes = new Set(WORKSPACE_EVENT_FIELD_TYPES);
    expect(uniqueTypes.size).toBe(WORKSPACE_EVENT_FIELD_TYPES.length);

    const allowed = new Set(WORKSPACE_EVENT_FIELD_TYPES);

    Object.entries(WORKSPACE_EVENT_CONTRACT).forEach(([eventName, descriptor]) => {
      expect(Object.isFrozen(descriptor)).toBe(true);
      expect(descriptor).toHaveProperty('detail');
      expect(Object.isFrozen(descriptor.detail)).toBe(true);

      Object.entries(descriptor.detail).forEach(([fieldName, field]) => {
        expect(Object.isFrozen(field)).toBe(true);
        expect(typeof field.type).toBe('string');
        expect(allowed.has(field.type)).toBe(true);

        if (Object.prototype.hasOwnProperty.call(field, 'optional')) {
          expect(typeof field.optional === 'boolean').toBe(true);
        }

        expect(typeof field.description === 'string' || field.description === undefined).toBe(
          true,
        );
      });
    });
  });
});
