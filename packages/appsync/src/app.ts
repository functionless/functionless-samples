import path from 'path';
import * as appsync from '@aws-cdk/aws-appsync-alpha';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { App, aws_dynamodb, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { $AWS, AppsyncResolver, Table, Function } from 'functionless';

const app = new App();
const stack = new Stack(app, 'functionlessAppSync');

interface Note {
  id: string;
  content: string;
}

const table = new Table<Note, 'id'>(stack, 'notes', {
  partitionKey: {
    name: 'id',
    type: aws_dynamodb.AttributeType.STRING,
  },
  // remove this in prod
  removalPolicy: RemovalPolicy.DESTROY,
});

const api = new appsync.GraphqlApi(stack, 'appsyncApi', {
  name: 'AppSyncApi',
  schema: new appsync.Schema({
    filePath: path.join(__dirname, './schema.graphql'),
  }),
});

// Mutation createNote
new AppsyncResolver<{ note: Note; [key: string]: any }, Note>(
  stack,
  'createNote',
  {
    fieldName: 'createNote',
    typeName: 'Mutation',
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
  },
);

const listNotes = new Function<undefined, Note[]>(
  stack,
  'listNotesFunction',
  async () => {
    const items = await $AWS.DynamoDB.Scan({ Table: table });

    return items.Items?.map((item): Note => unmarshall(item) as Note) ?? [];
  },
);

// Query listNotes
new AppsyncResolver(
  stack,
  'listNotes',
  {
    fieldName: 'listNotes',
    typeName: 'Query',
    api,
  },
  () => {
    return listNotes();
  },
);

// Query getNoteById
new AppsyncResolver<{ noteId: string }, Note>(
  stack,
  'getNoteById',
  {
    fieldName: 'getNoteById',
    typeName: 'Query',
    api,
  },
  (input) => {
    return table.appsync.getItem({
      key: {
        id: { S: input.arguments.noteId },
      },
    });
  },
);

// Mutation updateNote
new AppsyncResolver<{ note: Note; [key: string]: any }, Note>(
  stack,
  'updateNote',
  {
    fieldName: 'updateNote',
    typeName: 'Mutation',
    api,
  },
  (input) => {
    return table.appsync.updateItem({
      key: {
        id: { S: input.arguments.note.id },
      },
      update: {
        expression: 'SET content = :content',
        expressionValues: {
          ':content': { S: input.arguments.note.content },
        },
      },
    });
  },
);

// Mutation deleteNote
new AppsyncResolver<{ noteId: string }, Note>(
  stack,
  'deleteNote',
  {
    fieldName: 'deleteNote',
    typeName: 'Mutation',
    api,
  },
  (input) => {
    return table.appsync.deleteItem({
      key: {
        id: { S: input.arguments.noteId },
      },
    });
  },
);
