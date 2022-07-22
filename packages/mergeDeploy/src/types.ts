import { Function } from "functionless";

export enum DeploymentStatus {
    SUCCESSFUL = "SUCCESSFUL",
    WAITING = "WAITING",
    IN_PROGRESS = "IN_PROGRESS",
    FAILED = "FAILED",
  }
  
  export const DEFAULT_GROUP = "DEFAULT";
  export const FINAL_STAGE = "FINAL";
  
export  interface Deployment {
    id: string;
    input: string;
    state: DeploymentStatus;
    created: string;
    updated: string;
    groupId: string;
  }
  
export  interface Stage {
    stage: string;
    manifestId: string;
  }
  
export  interface ManifestEntry {
    id: string;
    manifest: string;
    created: string;
    group: string;
    parent: string;
  }
  
  // TODO: generalize
  export type Manifest = TestManifestV1;
  
export  const emptyManifest: Manifest = {
    count: 1,
    tenants: {},
    version: "1",
  };
  
  export const DYNAMO_CONSTANTS = {
    deployment: {
      id: "id",
      input: "input",
      state: "state",
      created: "created",
      updated: "updated",
      indexByCreated: "byGroupCreated",
      group: "group",
      parent: "parent",
    },
    stage: {
      stage: "stage",
      manifestId: "manifestId",
    },
    manifest: {
      id: "id",
      manifest: "manifest",
      created: "created",
      indexByCreated: "byGroupCreated",
      group: "group",
      parent: "parent",
    },
  };

  export interface TestRequest {
    tenantId: string;
    values: string[];
    command?: "CLEAR" | "MERGE"; // default merge
  }
  
  export interface TestManifestV1 {
    version: "1";
    count: number;
    tenants: Record<string, TenantRecordV1>;
  }
  
  export interface TenantRecordV1 {
    recentValues: string[];
    uniqueValues: string[];
    count: number;
  }
  
  export interface ValidateResponse {
    valid: boolean;
    errors?: string[];
  }
  
  export interface ValidateManifestRequest<R = Manifest> {
    current: R;
    updated: R;
  }
  
  export type ValidateFunction = Function<
    ValidateManifestRequest,
    ValidateResponse
  >;