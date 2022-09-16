import { App, Duration, Stack } from 'aws-cdk-lib';
import { Schedule } from 'aws-cdk-lib/aws-events';
import { EventBus, Function } from 'functionless';
import fetch from 'node-fetch';

const app = new App();
const stack = new Stack(app, 'functionlessCron');

const job = new Function(stack, 'cronJob', async () => {
  const metaphors = await fetch('http://metaphorpsum.com/sentences/5').then(
    (x) => x.text(),
  );
  console.log(metaphors);
});

EventBus.schedule(stack, 'cron', Schedule.rate(Duration.minutes(1))).pipe(job);
