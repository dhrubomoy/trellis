# trellis

## Create a LSP generator tool called "trellis" similar to langium

### Similarity with langium:
- Define one grammar that is similar to langium's grammar, and the trellis will generate the parser and LSP
- langium's dependency injection architecture should stay
- Similar to langium, trellis should generate the default LSP features, with option for the user to extend these default classes.
- Because of this code architecture that is similar to langium's, it should be easy to debug (set breakpoint), write unit tests for different life cycle (parsing - linking - LSP stuff (autocomplete, hover, go to definition etc))

### Differences:
- Instead of chevrotain, trellis will use tree-sitter. The grammar will be similar to langium's as much as possible, but will need to accommodate tree-sitter's features. How to support these features needs to be discussed carefully during the development phases.
- We need to look options to get rid of the how langium constructs CST altogether. Even typefox is moving away from langium due to performance issues. They are creating a new service in go: https://www.typefox.io/blog/xtext-langium-what-next/
> While collaborating on the PL/I Language Support of the Zowe project, we’ve already seen what this can unlock: we replaced the CST completely with metadata on the input tokens. This has completely eliminated the overhead of constructing the CST, while still retaining the essential information we need from it. The performance gains in this setup were substantial, and they point clearly toward a different architectural direction.
- For scope resolution, use research about `tree-sitter-graph`, whether it can be used, instead of langium's scope resolution.


### Reason for choosing treesitter:
- performance and memory issues with chevrotain. 
- Incremental parsing in tree-sitter.

