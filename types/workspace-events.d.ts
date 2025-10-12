import type { WORKSPACE_EVENT_CONTRACT } from '../src/workspace/events-contract.js';

type WorkspaceEventContractMap = typeof WORKSPACE_EVENT_CONTRACT;

type FieldTypeMap = {
  boolean: boolean;
  number: number;
  'number|null': number | null;
  'number|undefined': number | undefined;
  'number[]': number[];
  string: string;
  'string|undefined': string | undefined;
  File: File;
  'File[]': File[];
  direction: 'next' | 'previous';
  bookmarkAction: 'add' | 'remove';
  bookmarkSource:
    | 'list'
    | 'next-button'
    | 'previous-button'
    | 'keyboard-next'
    | 'keyboard-previous';
  searchAction: 'search' | 'navigate' | 'previous' | 'next' | 'result';
  zoomMode: 'manual' | 'fit-width' | 'fit-page';
};

type WorkspaceEventFieldDescriptor = {
  type: keyof FieldTypeMap;
  optional?: boolean;
  [key: string]: unknown;
};

type DetailDescriptor = Record<string, WorkspaceEventFieldDescriptor>;

type DescriptorValue<T extends WorkspaceEventFieldDescriptor> = FieldTypeMap[
  T['type'] & keyof FieldTypeMap
];

type RequiredKeys<D extends DetailDescriptor> = {
  [K in keyof D]: D[K]['optional'] extends true ? never : K;
}[keyof D];

type OptionalKeys<D extends DetailDescriptor> = {
  [K in keyof D]: D[K]['optional'] extends true ? K : never;
}[keyof D];

type DetailFromDescriptor<D extends DetailDescriptor> = {
  [K in RequiredKeys<D>]: DescriptorValue<D[K]>;
} & {
  [K in OptionalKeys<D>]?: DescriptorValue<D[K]>;
};

export type WorkspaceEventDetailMap = {
  [K in keyof WorkspaceEventContractMap]: WorkspaceEventContractMap[K] extends {
    detail: infer D;
  }
    ? D extends DetailDescriptor
      ? DetailFromDescriptor<D>
      : never
    : never;
};

export type WorkspaceEventName = keyof WorkspaceEventDetailMap;

export type WorkspaceEventDetail<N extends WorkspaceEventName> =
  WorkspaceEventDetailMap[N];

export type WorkspaceCustomEvent<N extends WorkspaceEventName> = CustomEvent<
  WorkspaceEventDetail<N>
>;

declare global {
  interface HTMLElementEventMap extends WorkspaceEventDetailMap {}
  interface DocumentEventMap extends WorkspaceEventDetailMap {}
}

export {};
