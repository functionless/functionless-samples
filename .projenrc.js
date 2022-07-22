const { LernaProject } = require("lerna-projen");
const {FunctionlessProject} = require("@functionless/projen");

const packagesFolder = "packages";

const project = new LernaProject({
  defaultReleaseBranch: "main",
  devDeps: ["lerna-projen", '@functionless/projen'],
  name: "functionless-samples",
  eslintOptions: {
    lintProjenRc: true,
  },
  prettier: {}
  // deps: [],                /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  // packageName: undefined,  /* The "name" in package.json. */
});

const functionless1 = new FunctionlessProject({
  cdkVersion: '2.31.1',
  defaultReleaseBranch: 'main',
  devDeps: ['@functionless/projen'],
  parent: project,
  outdir: `${packagesFolder}/sample1`,
  name: 'sample1',
  tsconfig: {
    compilerOptions: {
      skipLibCheck: true
    }
  },
  // deps: [],                /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  // packageName: undefined,  /* The "name" in package.json. */
});

const mergeDeploy = new FunctionlessProject({
  cdkVersion: '2.31.1',
  defaultReleaseBranch: 'main',
  devDeps: ['@functionless/projen', 'typesafe-dynamodb'],
  parent: project,
  outdir: `${packagesFolder}/mergeDeploy`,
  name: 'mergeDeploy',
  tsconfig: {
    compilerOptions: {
      skipLibCheck: true
    }
  },
  // deps: [],                /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  // packageName: undefined,  /* The "name" in package.json. */
});

project.addSubProject(functionless1);
project.addSubProject(mergeDeploy);

project.synth();