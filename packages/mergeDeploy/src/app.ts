import { App, aws_dynamodb, Stack } from "aws-cdk-lib";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { SSM } from "aws-sdk";
import { $AWS, $SFN, Function, StepFunction, Table } from "functionless";
import {
  // DeployStage,
  StagePrepareRequest,
  StagePrepareResponse,
  StageTestRequest,
  StageTestResponse,
} from "./constructs/DeploymentStage";
import {
  ManifestEntry,
  TestRequest,
  TestManifestV1,
  TenantRecordV1,
  ValidateFunction,
  ValidateManifestRequest,
  ValidateResponse,
  DeploymentStatus,
  DEFAULT_GROUP,
  FINAL_STAGE,
  DYNAMO_CONSTANTS,
  emptyManifest,
  Deployment,
  Stage,
  Manifest,
} from "./types";

const app = new App();
const stack = new Stack(app, "sample/merge-deploy");

const deploymentTable = new Table<Deployment, "id">(stack, "deployments", {
  partitionKey: {
    name: "id",
    type: aws_dynamodb.AttributeType.STRING,
  },
});

const stageTable = new Table<Stage, "stage">(stack, "stages", {
  partitionKey: { name: "stage", type: aws_dynamodb.AttributeType.STRING },
});

const manifestTable = new Table<ManifestEntry, "id">(stack, "manifests", {
  partitionKey: {
    name: "id",
    type: aws_dynamodb.AttributeType.STRING,
  },
});

const mergeFunction = new Function(
  stack,
  "merge",
  async (event: { request: TestRequest; manifest: TestManifestV1 }) => {
    const manifestV1: TestManifestV1 =
      event.manifest.version === "1"
        ? (event.manifest as TestManifestV1)
        : ({
            count: 1,
            tenants: Object.entries(event.manifest).reduce(
              (acc, [id, values]) => ({
                ...acc,
                [id]: {
                  count: 1,
                  recentValues: values,
                  uniqueValues: values,
                } as TenantRecordV1,
              }),
              {} as Record<string, TenantRecordV1>
            ),
          } as TestManifestV1);

    const tenantRecord = manifestV1.tenants[event.request.tenantId] || {
      count: 0,
      uniqueValues: [],
      recentValues: [],
    };

    const clear = event.request.command === "CLEAR";

    return Promise.resolve({
      manifest: {
        version: "1" as const,
        count: clear ? 1 : manifestV1.count + 1,
        tenants: {
          ...(clear ? {} : manifestV1.tenants),
          [event.request.tenantId]: {
            count: tenantRecord.count + 1,
            recentValues: event.request.values,
            uniqueValues: [
              ...new Set([
                ...event.request.values,
                ...tenantRecord.uniqueValues,
              ]),
            ],
          },
        },
      },
    });
  }
);

const validate: ValidateFunction = new Function<
  ValidateManifestRequest,
  ValidateResponse
>(
  stack,
  "validateFunction",
  async (_input: { current: Manifest; updated: Manifest }) => {
    return { valid: true };
  }
);

export interface StateTransformRequest<R> {
  manifest: R;
  manifestId: string;
}

export interface UpdatedManifestFunction
  extends Function<StateTransformRequest<Manifest>, void> {}

const updatedManifestHook: UpdatedManifestFunction = new Function<
  StateTransformRequest<Manifest>,
  void
>(stack, "updatedManifestHook", async (input) => {
  console.log(
    "Found new manifest",
    input.manifestId,
    JSON.stringify(input.manifest)
  );
});

// const deployStages: DeployStage<{}>[] = [
//   {
//     name: "stage1",
//     prepareFunction: new Function<StagePrepareRequest, StagePrepareResponse<{}>>(
//       stack,
//       "stage1Prepare",
//       async (input) => {
//         console.log("prepare stage 1", input.deploymentId, input.manifest);
//         return { metadata: {} };
//       }
//     ),
//     testFunction: new Function<StageTestRequest<{}>, StageTestResponse>(
//       stack,
//       "stage1Test",
//       async (input) => {
//         console.log(
//           "testing stage 1",
//           input.deploymentId,
//           input.metadata,
//           input.manifest
//         );
//         return {
//           valid: true,
//         };
//       }
//     ),
//     parameter: new StringParameter(stack, "stage1Param", {
//       stringValue: "",
//     }),
//   },
// ];

// const deployStages: DeployStage<{}>[] = [
//   {
//     name: "stage1",
const prepareFunction = new Function<
  StagePrepareRequest,
  StagePrepareResponse<{}>
>(stack, "stage1Prepare", async (input) => {
  console.log("prepare stage 1", input.deploymentId, input.manifest);
  return { metadata: {} };
});
const testFunction = new Function<StageTestRequest<{}>, StageTestResponse>(
  stack,
  "stage1Test",
  async (input) => {
    console.log(
      "testing stage 1",
      input.deploymentId,
      input.metadata,
      input.manifest
    );
    return {
      valid: true,
    };
  }
);
const parameter = new StringParameter(stack, "stage1Param", {
  stringValue: "INITIAL",
});
//   },
// ];

// const stage = deployStages[0];

// NEED: SSM integration
const updateStageSSM = new Function(
  stack,
  "updateStageParam",
  async (input: { parameterName: string; deploymentId: string }) => {
    // NEED: access to the top of the function (factory) to create the SSM client once,
    const ssm = new SSM();
    await ssm.putParameter({
      Name: input.parameterName,
      Value: input.deploymentId,
    });
  }
);

const finalStageSSM = new StringParameter(stack, "finalStageSSM", {
  stringValue: "INITIAL",
});

/**
 * Needs:
 * * Current Date Time
 * * Logging
 * * Higher Order Functions: Flip Stage and Update Deployment should be funcitions
 * * Reference serialization - deploymentStage[0].parameter.parameterName
 * * Semaphore
 * * Integration in array
 */

new StepFunction<TestRequest, void>(
  stack,
  "deployerMachine",
  async (input, context) => {
    await $AWS.DynamoDB.PutItem({
      Table: deploymentTable,
      Item: {
        id: {
          S: context.Execution.Name,
        },
        input: {
          S: JSON.stringify(input),
        },
        state: { S: DeploymentStatus.WAITING },
        created: {
          S: context.Execution.StartTime,
        },
        updated: {
          S: context.Execution.StartTime,
        },
        groupId: { S: DEFAULT_GROUP },
      },
    });

    // TODO: lock semaphore

    // TODO: abstract to function
    await $AWS.DynamoDB.UpdateItem({
      Table: deploymentTable,
      Key: {
        id: {
          S: context.Execution.Name, // NEED: machine context object (Machine Name)
        },
      },
      UpdateExpression: "SET #state = :state, #updated = :updated",
      ExpressionAttributeNames: {
        "#state": "state",
        "#updated": "updated",
      },
      ExpressionAttributeValues: {
        ":state": { S: DeploymentStatus.IN_PROGRESS },
        ":prevState": { S: DeploymentStatus.WAITING },
        ":updated": { S: "" }, // NEED: date.now string
      },
      ConditionExpression: "#state = :prevState",
    });

    const stageManifest = await $AWS.DynamoDB.GetItem({
      Table: stageTable,
      Key: {
        stage: {
          S: FINAL_STAGE,
        },
      },
      ConsistentRead: true,
    });

    if (stageManifest.Item?.manifestId.S) {
      await $AWS.DynamoDB.UpdateItem({
        Table: deploymentTable,
        Key: {
          id: { S: context.Execution.Name },
        },
        UpdateExpression: "SET #parent = :parent",
        ExpressionAttributeNames: {
          "#parent": DYNAMO_CONSTANTS.deployment.parent,
        },
        ExpressionAttributeValues: {
          ":parent": stageManifest.Item.manifestId,
        },
      });
    }

    const currentManifestEntry = stageManifest.Item?.manifestId.S
      ? await $AWS.DynamoDB.GetItem({
          Table: manifestTable,
          Key: {
            id: stageManifest.Item.manifestId,
          },
          ConsistentRead: true,
        })
      : null;

    const currentManifest = currentManifestEntry?.Item
      ? {
          manifest: JSON.parse(
            currentManifestEntry.Item.manifest.S
          ) as Manifest,
          id: currentManifestEntry.Item.id.S,
        }
      : { manifest: emptyManifest, id: "" };

    const updated = await mergeFunction({
      request: input,
      manifest: currentManifest.manifest,
    });

    const valid = await validate({
      current: currentManifest.manifest,
      updated: updated.manifest,
    });

    if (!valid.valid) {
      // TODO: handle errors
      throw new Error("Something went wrong!");
    }

    // save manifest
    await $AWS.DynamoDB.PutItem({
      Table: manifestTable,
      Item: {
        id: { S: context.Execution.Name },
        // NEED: Date.Now()
        created: { S: context.Execution.StartTime },
        manifest: { S: JSON.stringify(updated.manifest) },
        group: { S: DEFAULT_GROUP },
        parent: { S: currentManifest.id },
      },
    });

    // call updated manifest hook
    // TODO: support 0-many
    await updatedManifestHook({
      manifest: updated.manifest,
      manifestId: context.Execution.Name,
    });

    /**
     * Deploy each stage
     */
    // for (const deployStage of deployStages) {
    //for (const deployStageIndex in deployStages) {
    // const deployStage = deployStages[0];
    // const deplayStage = stage
    const deployStage = {
      name: "stage1",
      // parameter: parameter,
      // prepareFunction: prepareFunction,
      // testFunction: testFunction
    };

    // flip stage
    await $SFN.parallel(
      () =>
        $AWS.DynamoDB.PutItem({
          Table: stageTable,
          Item: {
            stage: { S: deployStage.name },
            manifestId: { S: context.Execution.Name },
          },
        }),
      () =>
        updateStageSSM({
          parameterName: parameter.parameterArn,
          deploymentId: context.Execution.Name,
        })
    );
    // call prepare function
    const result = await prepareFunction({
      deploymentId: context.Execution.Name,
      manifest: updated.manifest,
      stage: deployStage.name,
    });
    // call test function
    const testResult = await testFunction({
      deploymentId: context.Execution.Name,
      manifest: updated.manifest,
      stage: deployStage.name,
      metadata: result.metadata,
    });
    // is valid?
    if (testResult.valid) {
      // TODO: rollback? clean up?
      // throw Error(`Something went wrong with stage: ${deployStage.name}`);
      throw Error(`Something went wrong with stage`);
    }
    //}

    await $SFN.parallel(
      () =>
        $AWS.DynamoDB.PutItem({
          Table: stageTable,
          Item: {
            stage: { S: FINAL_STAGE },
            manifestId: { S: context.Execution.Name },
          },
        }),
      () =>
        updateStageSSM({
          parameterName: finalStageSSM.parameterArn,
          deploymentId: context.Execution.Name,
        })
    );

    // TODO: abstract to function
    await $AWS.DynamoDB.UpdateItem({
      Table: deploymentTable,
      Key: {
        id: {
          S: context.Execution.Name,
        },
      },
      UpdateExpression: "SET #state = :state, #updated = :updated",
      ExpressionAttributeNames: {
        "#state": "state",
        "#updated": "updated",
      },
      ExpressionAttributeValues: {
        ":state": { S: DeploymentStatus.SUCCESSFUL },
        ":prevState": { S: DeploymentStatus.IN_PROGRESS },
        ":updated": { S: "" }, // NEED: date.now string
      },
      ConditionExpression: "#state = :prevState",
    });

    // TODO: unlock semaphore
  }
);
