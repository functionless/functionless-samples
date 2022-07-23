import { App, aws_dynamodb, Stack } from 'aws-cdk-lib';
import { Table } from 'functionless';
import { OptimizedSagaFunction } from './optimized-saga-function';
import { SagaFunction } from './saga-function';
import { BookingEntry } from './types';

const app = new App();
const stack = new Stack(app, 'sagaFunction');

const bookingsTable = new Table<BookingEntry, 'pk', 'sk'>(stack, 'Bookings', {
  partitionKey: { name: 'pk', type: aws_dynamodb.AttributeType.STRING },
  sortKey: { name: 'sk', type: aws_dynamodb.AttributeType.STRING },
});

new SagaFunction(stack, 'saga', {
  bookingsTable,
});

new OptimizedSagaFunction(stack, 'optimizedSaga', {
  bookingsTable,
});
