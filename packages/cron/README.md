# Create a Cron Job with Functionless

In this example, we'll create a Cron job.

The Cron Job will use [AWS EventBridge's](https://aws.amazon.com/eventbridge/) scheduled rules to trigger a job in a lambda [Lambda Functions](https://docs.aws.amazon.com/lambda/latest/dg/welcome.html).

Then we'll deploy and test the application.

To see the completely application, go [here](https://github.com/functionless/functionless-samples/packages/cron).

## Create an new app

> yarn create functionless

For a more detailed guide, see: https://functionless.org/docs/getting-started/setup

## Create the cron job

Replace your `app.ts` with (the imports will be useful later):

```ts
import { App, Duration, Stack } from "aws-cdk-lib";
import { Schedule } from "aws-cdk-lib/aws-events";
import { EventBus, Function } from "functionless";

const app = new App();
const stack = new Stack(app, "functionlessCron");

EventBus.schedule(stack, "cron", Schedule.rate(Duration.minutes(1)));
```

This create a rule which executes any targets every minutes. Lets give it something to do.

## Metaphors on the Minute

A scheduled rule is just an Event Bridge rule and an event bridge rule can trigger many different things. For now, we'll trigger a lambda function.

We are going to use an HTTP API, so we need a library to make the http call, lets use `node-fetch`.

> yarn add node-fetch @types/node-fetch

Add this line under the other imports

```ts
import fetch from "node-fetch";
```

Then add this function below that.

```ts
const job = new Function(stack, "cronJob", async () => {
  const metaphors = await fetch("http://metaphorpsum.com/sentences/5").then(
    (x) => x.text()
  );
  console.log(metaphors);
});
```

When this `Function` is invoked, it will call the `metaphorsum` api to get some text and then we'll print it out.

## Trigger the Function

Finally, we need to trigger the function using the scheduled rule.

Update the line with `EventBus.schedule...` to this:

```ts
EventBus.schedule(stack, "cron", Schedule.rate(Duration.minutes(1))).pipe(job);
```

Notice the `.pipe(job);` at the end. Now when our rule is triggered, every minute, the lambda will call the metaphor api and log the results.

## Permissions

But wait, when do I create policies and permissions for my resources to talk to each other?

Functionless handles this automatically. When you `.pipe()` to your lambda functions, a policy is created that grants access for EventBus to call Lambda. likewise, a policy is created to allow API Gateway to call `PutEvents` on the event bus used in `AwsMethod`.

## Deploy

To deploy, run:

> yarn deploy

For a more in depth overview of the deployment process, see [deploy project](https://functionless.org/docs/getting-started/deploy-project).

## Verification

### Verify Execution

We can look at the lambda logs to watch our cron in action.

1. Go the lambda UI
2. Find search for "cronJob"
3. click on the function name
4. click on monitoring
5. click on view cloudwatch logs

There should be a log stream, in that log stream you should see the metaphors the api returns.

Every minute a new set of metaphors will be displayed.

## Next Steps

Try [another example](https://github.com/functionless/functionless-samples) or visit the Functionless documentation to learn about more of what Functionless can do.
