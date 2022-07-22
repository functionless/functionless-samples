### Run commands

Run commands with Turbo

`npx turbo run [build/deploy]`

### New Sample

For a new Functionless Project, add a new `FunctionlessProject` block in the `projenrc.ts` file. 

Like:

```ts
new FunctionlessProject({
  parent: turbo,
  defaultReleaseBranch: 'main',
  name: '[project_name]',
  outdir: 'packages/[project_name]',
  cdkVersion: '2.33.0'
})
```