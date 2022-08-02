import { App, aws_dynamodb, Stack } from 'aws-cdk-lib';
import { RestApi } from 'aws-cdk-lib/aws-apigateway';
import {
  ApiBody,
  ApiGatewayInput,
  ApiRequest,
  AwsMethod,
  Table,
} from 'functionless';
import { OptimizedSagaFunction } from './optimized-saga-function';
import { SagaFunction } from './saga-function';
import { BookingEntry, Reservation, RunType } from './types';

const app = new App();
const stack = new Stack(app, 'sagaFunction');

const bookingsTable = new Table<BookingEntry, 'pk', 'sk'>(stack, 'Bookings', {
  partitionKey: { name: 'pk', type: aws_dynamodb.AttributeType.STRING },
  sortKey: { name: 'sk', type: aws_dynamodb.AttributeType.STRING },
});

const sagaFunction = new SagaFunction(stack, 'saga', {
  bookingsTable,
});

const optimizedSagaFunction = new OptimizedSagaFunction(
  stack,
  'optimizedSaga',
  {
    bookingsTable,
  },
);

const api = new RestApi(stack, 'api');

const saga = api.root.addResource('saga');
const optimized = api.root.addResource('optimized');

interface Request
  extends ApiGatewayInput<
  ApiRequest<
  {},
  Reservation & { [index: string]: ApiBody },
  { runType?: RunType }
  >
  > {}

/**
 * POST https://{api_domain}/saga
 * POST https://{api_domain}/saga?run_type=failPayment
 */
new AwsMethod(
  {
    httpMethod: 'POST',
    resource: saga,
  },
  ($input: Request) => {
    return sagaFunction.func({
      input: {
        reservation: $input.data!,
        run_type: $input.params('runType')!,
      },
    });
  },
  (result) => {
    return result.data;
  },
);

/**
 * POST https://{api_domain}/optimized
 * POST https://{api_domain}/optimized?run_type=failPayment
 */
new AwsMethod(
  {
    httpMethod: 'POST',
    resource: optimized,
  },
  ($input: Request) => {
    return optimizedSagaFunction.func({
      input: {
        reservation: $input.data!,
        run_type: $input.params('runType')!,
      },
    });
  },
  (result) => {
    return result.data;
  },
);
