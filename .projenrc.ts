import { FunctionlessProject } from "@functionless/projen";
import { Husky } from "@mountainpass/cool-bits-for-projen";
import { TurborepoProject } from "projen-turborepo";
import { GithubCredentials } from "projen/lib/github";

const turbo = new TurborepoProject({
  defaultReleaseBranch: "main",
  devDeps: [
    "projen-turborepo",
    "@functionless/projen",
    "lint-staged",
    "@mountainpass/cool-bits-for-projen",
  ],
  name: "functionless-samples",
  projenrcTs: true,
  turbo: {
    pipeline: {
      deploy: {},
      synth: {},
      prepare: {},
    },
  },
  prettier: true,
  eslintOptions: {
    dirs: [],
    lintProjenRc: true,
    prettier: true,
  },
  depsUpgradeOptions: {
    workflowOptions: {
      projenCredentials: GithubCredentials.fromApp(),
    },
  },
  gitignore: [".swc"],
  // deps: [],                /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  // packageName: undefined,  /* The "name" in package.json. */
});

// prepare is not run when install sub-package, run prepare to run the functionless requirement `ts-patch install -s`
turbo.setScript("postinstall", "turbo run prepare");

new FunctionlessProject({
  parent: turbo,
  defaultReleaseBranch: "main",
  name: "sample1",
  outdir: "packages/sample1",
  cdkVersion: "2.39.1",
});

const packageJson = turbo.tryFindObjectFile("package.json");

packageJson?.addOverride("lint-staged", {
  "*.{tsx,jsx,ts,js,json,md}": ["turbo run eslint -- --"],
});

new Husky(turbo, {
  huskyHooks: {
    "pre-commit": ["#!/bin/sh", "npx -y lint-staged"],
  },
});

const eslintJson = turbo.tryFindObjectFile(".eslintrc.json");
eslintJson?.addOverride("parserOptions.project", [
  "./tsconfig.dev.json",
  "./packages/sample1/tsconfig.dev.json",
]);

new FunctionlessProject({
  parent: turbo,
  defaultReleaseBranch: "main",
  name: "sagaFunction",
  outdir: "packages/sagaFunction",
  cdkVersion: "2.39.1",
});

new FunctionlessProject({
  parent: turbo,
  defaultReleaseBranch: "main",
  name: "eventBridge",
  outdir: "packages/eventBridge",
  cdkVersion: "2.39.1",
  tsconfig: {
    compilerOptions: {
      skipLibCheck: false,
    },
  },
});

turbo.synth();
