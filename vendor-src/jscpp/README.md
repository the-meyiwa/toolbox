# JSCPP build for the Code Playground

`public/vendor/jscpp/JSCPP.min.js` is [thatcrazydave/JSCPP](https://github.com/thatcrazydave/JSCPP)
(MIT) at `c95d159`, with `toolbox-fixes.patch` applied, bundled as a classic
script so the Playground worker can load it with `importScripts`.

```sh
git clone https://github.com/thatcrazydave/JSCPP && cd JSCPP
git checkout c95d159 && git apply ../toolbox/vendor-src/jscpp/toolbox-fixes.patch
npm install --ignore-scripts && ./rebuild.sh
node ../toolbox/vendor-src/jscpp/build-iife.mjs ../toolbox/public/vendor/jscpp/JSCPP.min.js
```

## What the patch fixes

Each was found by running ordinary course programs through the Playground.
The fork's own C suite (45/45) and upstream's 51-program corpus give
identical per-test results with and without it.

| Program | Before | After |
|---|---|---|
| `vector<int> v(n);` | silently empty (size 0) | n zeros |
| `vector<int> v(n, x);` | runtime crash | n copies of x |
| `A* p = new A(5);` | parse error | constructs with the arguments |
| `while (cin >> x)` at end of input | "overflow of NaN" | loop ends, x = 0 (as C++11) |
| `getline(cin, s)`, `cin >> x` | echoed the input into the output | echo only when `printStdin` is not `false` |
| editing `pegjs/ast.pegjs` | ignored: `tsc` copied the committed `src/ast.js` over the new parser | `rebuild.sh` regenerates both copies |

Still unsupported, as before: `virtual`, brace initialisation (`P a{1, 2};`),
`<map>`/`<set>`, and `while (getline(cin, s))` at end of input.
