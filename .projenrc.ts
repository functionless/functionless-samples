import { TurborepoProject } from 'projen-turborepo';
import {FunctionlessProject} from'@functionless/projen';

const turbo = new TurborepoProject({
  defaultReleaseBranch: 'main',
  devDeps: ['projen-turborepo', '@functionless/projen'],
  name: 'functionless-samples',
  projenrcTs: true,
  turbo: {
    pipeline: {
      "deploy" : {},
      "synth": {},
      "prepare": {}
    }
  }

  // deps: [],                /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  // packageName: undefined,  /* The "name" in package.json. */
});

// prepare is not run when install sub-package, run prepare to run the functionless requirement `ts-patch install -s`
turbo.setScript("preinstall", "turbo run prepare")

new FunctionlessProject({
  parent: turbo,
  defaultReleaseBranch: 'main',
  name: 'sample1',
  outdir: 'packages/sample1',
  cdkVersion: '2.33.0'
})

turbo.synth();