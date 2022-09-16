# Create a Cron Job with Functionless

In this example, we'll create a GraphQL API using AWS AppSync.

Our API will interact with Dynamo DB to create, retrieve and update notes.

Then we'll deploy and test the application.

To see the complete application, go [here](https://github.com/functionless/functionless-samples/packages/appsync).

## Create an new app

> yarn create functionless

For a more detailed guide, see: https://functionless.org/docs/getting-started/setup

## Create the Table

Replace your `app.ts` with (the imports will be useful later):

```ts
import path from "path";
import * as appsync from "@aws-cdk/aws-appsync-alpha";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { App, aws_dynamodb, RemovalPolicy, Stack } from "aws-cdk-lib";
import { $AWS, AppsyncResolver, Table, Function } from "functionless";

const app = new App();
const stack = new Stack(app, "functionlessAppSync");

interface Note {
  id: string;
  content: string;
}

const table = new Table<>(stack, "notes", {
  partitionKey: {
    name: "id",
    type: aws_dynamodb.AttributeType.STRING,
  },
  // remove this in prod
  removalPolicy: RemovalPolicy.DESTROY,
});
```

This will create a table which will hold the notes for our application.

Notice that we defined the simple interface for a `Note` which AppSync and Dynamo will use.

```ts
interface Note {
  id: string;
  content: string;
}
```

## GraphQL Schema

Now we need to write the [schema file](https://graphql.org/learn/schema/) that GraphQL will use.

Create a new file called `schema.graphql` and add the following to it.

```graphql
type Note {
  id: ID!
  content: String!
}

input NoteInput {
  id: ID!
  content: String!
}

input UpdateNoteInput {
  id: ID!
  content: String
}

type Query {
  listNotes: [Note]
  getNoteById(noteId: String!): Note
}

type Mutation {
  createNote(note: NoteInput!): Note
  deleteNote(noteId: String!): String
  updateNote(note: UpdateNoteInput!): Note
}
```

Note: it is possible to define the schema as code as well, see the [functionless docs for more info](https://functionless.org/docs/concepts/appsync/usage#create-a-graphql-schema-with-code).

## Create the GraphQL API

Lets create an Graph API. Add the following below the table.

```ts
const api = new appsync.GraphqlApi(stack, "appsyncApi", {
  name: "AppSyncApi",
  schema: new appsync.Schema({
    filePath: path.join(__dirname, "./schema.graphql"),
  }),
});
```

## Resolves

Finally lets implement the methods defined in our graphql schema. Add each of the following below the API:

### Create Note

Our `createNote` resolver will make the call to dynamo.

```ts
// Mutation createNote
new AppsyncResolver<{ note: Note; [key: string]: any }, Note>(
  stack,
  "createNote",
  {
    fieldName: "createNote",
    typeName: "Mutation",
    api,
  },
  (input) => {
    return table.appsync.putItem({
      key: {
        id: { S: input.arguments.note.id },
      },
      attributeValues: {
        content: { S: input.arguments.note.content },
      },
    });
  }
);
```

### List Notes

For list notes, we'll use scan to get all of the items in the table.

Functionless does not support `scan` on dynamo yet for AppSync, so lets make a lambda `Function` to do the heavy lifting.

```ts
const listNotes = new Function<undefined, Note[]>(
  stack,
  "listNotesFunction",
  async () => {
    const items = await $AWS.DynamoDB.Scan({ Table: table });

    return items.Items?.map((item): Note => unmarshall(item) as Note) ?? [];
  }
);

// Query listNotes
new AppsyncResolver(
  stack,
  "listNotes",
  {
    fieldName: "listNotes",
    typeName: "Query",
    api,
  },
  () => {
    return listNotes();
  }
);
```

### And all of the rest

`getNoteById`, `updateNote`, and `deleteNote` use the same patterns, lets add them in.

```ts
// Query getNoteById
new AppsyncResolver<{ noteId: string }, Note>(
  stack,
  "getNoteById",
  {
    fieldName: "getNoteById",
    typeName: "Query",
    api,
  },
  (input) => {
    return table.appsync.getItem({
      key: {
        id: { S: input.arguments.noteId },
      },
    });
  }
);

// Mutation updateNote
new AppsyncResolver<{ note: Note; [key: string]: any }, Note>(
  stack,
  "updateNote",
  {
    fieldName: "updateNote",
    typeName: "Mutation",
    api,
  },
  (input) => {
    return table.appsync.updateItem({
      key: {
        id: { S: input.arguments.note.id },
      },
      update: {
        expression: "SET content = :content",
        expressionValues: {
          ":content": { S: input.arguments.note.content },
        },
      },
    });
  }
);

// Mutation deleteNote
new AppsyncResolver<{ noteId: string }, Note>(
  stack,
  "deleteNote",
  {
    fieldName: "deleteNote",
    typeName: "Mutation",
    api,
  },
  (input) => {
    return table.appsync.deleteItem({
      key: {
        id: { S: input.arguments.noteId },
      },
    });
  }
);
```

## Permissions

But wait, when do I create policies and permissions for my resources to talk to each other?

Functionless handles this automatically. When you use the `Table` in the `AppSyncResolver`, a policy is created that grants access for EventBus to call Lambda. likewise, a policy is created to allows the `listFunction` to call `Scan` on the on the `Table`.

## Deploy

To deploy, run:

> yarn deploy

For a more in depth overview of the deployment process, see [deploy project](https://functionless.org/docs/getting-started/deploy-project).

## Verification

... go to the console

... make example queries

```ts
mutation MyMutation {
  createNote(note: {content: "hullo", id: "1"}) {
    content
    id
  }
}

query MyQuery {
  getNoteById(noteId: "1") {
    content
    id
  }
  listNotes {
    content
    id
  }
}

mutation MyMutation {
  updateNote(note: {id: "1", content: "bye"}) {
    content
    id
  }
}

query MyQuery {
  getNoteById(noteId: "1") {
    content
    id
  }
}

mutation MyMutation {
  deleteNote(noteId: "1")
}
```
