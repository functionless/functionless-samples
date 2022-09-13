import { App, Stack } from 'aws-cdk-lib';
import { RestApi } from 'aws-cdk-lib/aws-apigateway';
import { AwsMethod, EventBus, Function } from 'functionless';

const app = new App();
const stack = new Stack(app, 'stack');

const receipt = new Function(stack, 'receipt', async () => {
  console.log('receipt sent!');
});
const shipping = new Function(stack, 'shipping', async () => {
  console.log('item shipped');
});

const bus = new EventBus(stack, 'Ordered');

const whenOrder = bus.when(
  'rule1',
  (event) => event.source === 'myevent' && event['detail-type'] === 'Order',
);

whenOrder.pipe(receipt);
whenOrder.pipe(shipping);

const api = new RestApi(stack, 'api');
const order = api.root.addResource('order');

const method = new AwsMethod(
  { httpMethod: 'POST', resource: order },
  async () =>
    bus.putEvents({
      'detail-type': 'Order',
      'source': 'myEvent',
      'detail': {
        id: 123,
        name: 'My order',
        items: [{ id: '1', name: 'my Item', price: 10 }],
      },
    }),
);
