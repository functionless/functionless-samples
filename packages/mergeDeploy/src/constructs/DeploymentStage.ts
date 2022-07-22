import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Manifest } from "aws-cdk-lib/cloud-assembly-schema";
import { Construct } from "constructs";
import { Function, FunctionClosure } from "functionless";

export interface StagePrepareRequest {
  manifest: Manifest;
  stage: string;
  deploymentId: string;
}

export interface StagePrepareResponse<R> {
  metadata: R;
}

export interface StageTestRequest<R> {
  manifest: Manifest;
  stage: string;
  metadata: R;
  deploymentId: string;
}

export interface StageTestResponse {
  valid: boolean;
  errors?: string[];
}

export interface StagePrepareFunction<R>
  extends Function<StagePrepareRequest, StagePrepareResponse<R>> {}

export interface StageTestFunction<R>
  extends Function<StageTestRequest<R>, StageTestResponse> {}

export interface DeployStage<R> {
  readonly name: string;
  // TODO: allow it to be optional
  readonly prepareFunction: StagePrepareFunction<R>;
  // TODO: allow it to be optional
  readonly testFunction: StageTestFunction<R>;
  readonly parameter: StringParameter;
}
