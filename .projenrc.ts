import { TurborepoProject } from 'projen-turborepo';
const project = new TurborepoProject({
  defaultReleaseBranch: 'main',
  devDeps: ['projen-turborepo'],
  name: 'functionless-samples',
  projenrcTs: true,

  // deps: [],                /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  // packageName: undefined,  /* The "name" in package.json. */
});
project.synth();