const { LernaProject } = require("lerna-projen");
const {FunctionlessProject} = require("@functionless/projen");

const project = new LernaProject({
  defaultReleaseBranch: "main",
  devDeps: ["lerna-projen", '@functionless/projen'],
  name: "functionless-samples",
  // deps: [],                /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  // packageName: undefined,  /* The "name" in package.json. */
});

const functionless1 = new FunctionlessProject({
  cdkVersion: '2.31.1',
  defaultReleaseBranch: 'main',
  devDeps: ['@functionless/projen', "ts-node@latest"],
  parent: project,
  outdir: "packages/sample1",
  name: 'sample1',
  tsconfig: {
    compilerOptions: {
      skipLibCheck: true
    }
  },
  eslintOptions: {
    lintProjenRc: true,
  },
  prettier: {}

  // deps: [],                /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  // packageName: undefined,  /* The "name" in package.json. */
});

project.addSubProject(functionless1);

project.synth();