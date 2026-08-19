/* ============================================================
   Remote compilation.

   Some languages simply cannot run in a browser. C, C++, Swift, Go,
   Rust, Java and friends need a real toolchain, and there is no
   WebAssembly build of one small enough to ship to a phone. So they are
   compiled on a server — and because that means the code leaves the
   device, the UI says so plainly rather than hiding it.

   Wandbox is used because it is free, needs no key, and has been public
   for over a decade. (Piston, the obvious alternative, became whitelist
   only in February 2026 — it still lists runtimes but returns 401 on
   execute, which is exactly the kind of quiet breakage worth avoiding.)

   Everything here is optional: the locally-run languages in
   code-runtimes.js work with no network at all.
   ============================================================ */

const ENDPOINT = 'https://wandbox.org/api/compile.json';

/**
 * Languages compiled remotely. `compiler` is Wandbox's identifier;
 * versions are pinned so a silent upstream change cannot alter results.
 * @typedef {object} RemoteLang
 * @property {string} name
 * @property {string} compiler
 * @property {string} version
 * @property {string} mono      syntax hint for the editor
 * @property {string} [options] compiler flags
 * @property {string} sample
 */

/** @type {Record<string, RemoteLang>} */
export const REMOTE_LANGUAGES = {
  c: {
    name: 'C', compiler: 'gcc-9.3.0-c', version: '9.3.0', mono: 'c', options: '-O2 -std=c17',
    sample: `#include <stdio.h>
#include <string.h>

/* Reverse a string in place — the classic interview warm-up. */
void reverse(char *s) {
    for (int i = 0, j = strlen(s) - 1; i < j; i++, j--) {
        char t = s[i]; s[i] = s[j]; s[j] = t;
    }
}

int main(void) {
    char word[] = "toolbox";
    reverse(word);
    printf("reversed: %s\\n", word);

    for (int i = 1; i <= 5; i++) printf("%d squared is %d\\n", i, i * i);
    return 0;
}`,
  },
  cpp: {
    name: 'C++', compiler: 'gcc-9.3.0', version: '9.3.0', mono: 'cpp', options: '-O2 -std=c++17',
    sample: `#include <iostream>
#include <vector>
#include <algorithm>
#include <numeric>

int main() {
    std::vector<int> marks{72, 58, 91, 64, 88};

    std::sort(marks.begin(), marks.end(), std::greater<int>());
    int total = std::accumulate(marks.begin(), marks.end(), 0);

    std::cout << "sorted: ";
    for (int m : marks) std::cout << m << ' ';
    std::cout << "\\naverage: " << total / marks.size() << '\\n';
    return 0;
}`,
  },
  swift: {
    name: 'Swift', compiler: 'swift-6.0.1', version: '6.0.1', mono: 'swift',
    sample: `struct Invoice {
    let client: String
    let amount: Double
    let paid: Bool
}

let invoices = [
    Invoice(client: "Northwind", amount: 24500, paid: true),
    Invoice(client: "Contoso",   amount: 81200, paid: true),
    Invoice(client: "Fabrikam",  amount: 12750, paid: false),
]

let outstanding = invoices.filter { !$0.paid }.reduce(0) { $0 + $1.amount }

print("invoices:", invoices.count)
print("outstanding:", outstanding)

for i in 1...5 { print("\\(i) squared is \\(i * i)") }`,
  },
  php: {
    name: 'PHP', compiler: 'php-8.3.12', version: '8.3.12', mono: 'php',
    sample: `<?php
$invoices = [
    ['client' => 'Northwind', 'amount' => 24500, 'paid' => true],
    ['client' => 'Contoso',   'amount' => 81200, 'paid' => true],
    ['client' => 'Fabrikam',  'amount' => 12750, 'paid' => false],
];

$outstanding = array_sum(
    array_column(array_filter($invoices, fn($i) => !$i['paid']), 'amount')
);

printf("invoices: %d\\n", count($invoices));
printf("outstanding: %s\\n", number_format($outstanding));

foreach (range(1, 5) as $i) {
    echo "$i squared is " . $i ** 2 . PHP_EOL;
}`,
  },
  java: {
    name: 'Java', compiler: 'openjdk-jdk-22+36', version: 'jdk 22', mono: 'java',
    sample: `import java.util.*;
import java.util.stream.*;

public class Main {
    record Invoice(String client, double amount, boolean paid) {}

    public static void main(String[] args) {
        var invoices = List.of(
            new Invoice("Northwind", 24500, true),
            new Invoice("Contoso",   81200, true),
            new Invoice("Fabrikam",  12750, false)
        );

        double outstanding = invoices.stream()
            .filter(i -> !i.paid())
            .mapToDouble(Invoice::amount)
            .sum();

        System.out.println("invoices: " + invoices.size());
        System.out.printf("outstanding: %,.2f%n", outstanding);

        IntStream.rangeClosed(1, 5)
            .forEach(i -> System.out.println(i + " squared is " + i * i));
    }
}`,
  },
  csharp: {
    name: 'C#', compiler: 'dotnetcore-8.0.402', version: '8.0', mono: 'csharp',
    sample: `using System;
using System.Linq;

record Invoice(string Client, decimal Amount, bool Paid);

class Program {
    static void Main() {
        var invoices = new[] {
            new Invoice("Northwind", 24500m, true),
            new Invoice("Contoso",   81200m, true),
            new Invoice("Fabrikam",  12750m, false),
        };

        var outstanding = invoices.Where(i => !i.Paid).Sum(i => i.Amount);

        Console.WriteLine($"invoices: {invoices.Length}");
        Console.WriteLine($"outstanding: {outstanding:N2}");

        foreach (var i in Enumerable.Range(1, 5))
            Console.WriteLine($"{i} squared is {i * i}");
    }
}`,
  },
  go: {
    name: 'Go', compiler: 'go-1.23.2', version: '1.23', mono: 'go',
    sample: `package main

import (
	"fmt"
	"sort"
)

func main() {
	marks := []int{72, 58, 91, 64, 88}
	sort.Sort(sort.Reverse(sort.IntSlice(marks)))

	total := 0
	for _, m := range marks {
		total += m
	}

	fmt.Println("sorted:", marks)
	fmt.Printf("average: %.1f\\n", float64(total)/float64(len(marks)))

	for i := 1; i <= 5; i++ {
		fmt.Printf("%d squared is %d\\n", i, i*i)
	}
}`,
  },
  rust: {
    name: 'Rust', compiler: 'rust-1.82.0', version: '1.82', mono: 'rust',
    sample: `#[derive(Debug)]
struct Invoice { client: &'static str, amount: f64, paid: bool }

fn main() {
    let invoices = vec![
        Invoice { client: "Northwind", amount: 24500.0, paid: true },
        Invoice { client: "Contoso",   amount: 81200.0, paid: true },
        Invoice { client: "Fabrikam",  amount: 12750.0, paid: false },
    ];

    let outstanding: f64 = invoices.iter()
        .filter(|i| !i.paid)
        .map(|i| i.amount)
        .sum();

    println!("invoices: {}", invoices.len());
    println!("outstanding: {:.2}", outstanding);

    for i in 1..=5 { println!("{} squared is {}", i, i * i); }
}`,
  },
  ruby: {
    name: 'Ruby', compiler: 'ruby-4.0.2', version: '4.0', mono: 'ruby',
    sample: `invoices = [
  { client: 'Northwind', amount: 24_500, paid: true  },
  { client: 'Contoso',   amount: 81_200, paid: true  },
  { client: 'Fabrikam',  amount: 12_750, paid: false },
]

outstanding = invoices.reject { |i| i[:paid] }.sum { |i| i[:amount] }

puts "invoices: #{invoices.size}"
puts "outstanding: #{outstanding}"

(1..5).each { |i| puts "#{i} squared is #{i**2}" }`,
  },
  kotlin: {
    name: 'Scala', compiler: 'scala-3.5.1', version: '3.5', mono: 'scala',
    sample: `case class Invoice(client: String, amount: Double, paid: Boolean)

@main def run(): Unit =
  val invoices = List(
    Invoice("Northwind", 24500, true),
    Invoice("Contoso",   81200, true),
    Invoice("Fabrikam",  12750, false),
  )

  val outstanding = invoices.filterNot(_.paid).map(_.amount).sum

  println(s"invoices: \${invoices.size}")
  println(s"outstanding: \$outstanding")

  (1 to 5).foreach(i => println(s"\$i squared is \${i * i}"))`,
  },
  haskell: {
    name: 'Haskell', compiler: 'ghc-9.10.1', version: '9.10', mono: 'haskell',
    sample: `import Data.List (sortBy)
import Data.Ord (comparing, Down(..))

data Invoice = Invoice { client :: String, amount :: Double, paid :: Bool }

invoices :: [Invoice]
invoices =
  [ Invoice "Northwind" 24500 True
  , Invoice "Contoso"   81200 True
  , Invoice "Fabrikam"  12750 False
  ]

main :: IO ()
main = do
  let outstanding = sum [amount i | i <- invoices, not (paid i)]
  putStrLn $ "invoices: " ++ show (length invoices)
  putStrLn $ "outstanding: " ++ show outstanding
  mapM_ (\\i -> putStrLn (show i ++ " squared is " ++ show (i * i))) [1 .. 5 :: Int]`,
  },
  perl: {
    name: 'Perl', compiler: 'perl-5.42.0', version: '5.42', mono: 'perl',
    sample: `use strict;
use warnings;
use List::Util qw(sum0);

my @invoices = (
    { client => 'Northwind', amount => 24500, paid => 1 },
    { client => 'Contoso',   amount => 81200, paid => 1 },
    { client => 'Fabrikam',  amount => 12750, paid => 0 },
);

my $outstanding = sum0 map { $_->{amount} } grep { !$_->{paid} } @invoices;

printf "invoices: %d\\n", scalar @invoices;
printf "outstanding: %d\\n", $outstanding;
printf "%d squared is %d\\n", $_, $_ ** 2 for 1 .. 5;`,
  },
  bash: {
    name: 'Bash', compiler: 'bash', version: '5.2', mono: 'bash',
    sample: `#!/usr/bin/env bash
set -euo pipefail

declare -A marks=( [ada]=72 [alan]=58 [grace]=91 [linus]=64 )

total=0
for name in "\${!marks[@]}"; do
  printf '%-6s %3d\\n' "$name" "\${marks[$name]}"
  (( total += marks[$name] ))
done

echo "average: $(( total / \${#marks[@]} ))"

for i in {1..5}; do echo "$i squared is $(( i * i ))"; done`,
  },
  pascal: {
    name: 'Pascal', compiler: 'fpc-3.2.2', version: '3.2', mono: 'pascal',
    sample: `program Squares;
var
  i, total: Integer;
begin
  total := 0;
  for i := 1 to 5 do
  begin
    WriteLn(i, ' squared is ', i * i);
    total := total + i * i;
  end;
  WriteLn('total: ', total);
end.`,
  },
  r: {
    name: 'R', compiler: 'r-4.4.1', version: '4.4', mono: 'r',
    sample: `marks <- c(ada = 72, alan = 58, grace = 91, linus = 64, hedy = 88)

cat("n:", length(marks), "\\n")
cat("mean:", round(mean(marks), 1), "\\n")
cat("sd:", round(sd(marks), 2), "\\n\\n")

print(sort(marks, decreasing = TRUE))

for (i in 1:5) cat(i, "squared is", i^2, "\\n")`,
  },
  zig: {
    name: 'Zig', compiler: 'zig-0.9.1', version: '0.9', mono: 'zig',
    sample: `const std = @import("std");

pub fn main() !void {
    const stdout = std.io.getStdOut().writer();
    var i: u32 = 1;
    while (i <= 5) : (i += 1) {
        try stdout.print("{d} squared is {d}\\n", .{ i, i * i });
    }
}`,
  },
  elixir: {
    name: 'Elixir', compiler: 'elixir-1.17.3', version: '1.17', mono: 'elixir',
    sample: `invoices = [
  %{client: "Northwind", amount: 24_500, paid: true},
  %{client: "Contoso",   amount: 81_200, paid: true},
  %{client: "Fabrikam",  amount: 12_750, paid: false}
]

outstanding =
  invoices
  |> Enum.reject(& &1.paid)
  |> Enum.map(& &1.amount)
  |> Enum.sum()

IO.puts("invoices: #{length(invoices)}")
IO.puts("outstanding: #{outstanding}")

Enum.each(1..5, fn i -> IO.puts("#{i} squared is #{i * i}") end)`,
  },
  lisp: {
    name: 'OCaml', compiler: 'ocaml-5.2.0', version: '5.2', mono: 'ocaml',
    sample: `let invoices = [
  ("Northwind", 24500., true);
  ("Contoso",   81200., true);
  ("Fabrikam",  12750., false);
]

let () =
  let outstanding =
    List.fold_left (fun acc (_, amt, paid) -> if paid then acc else acc +. amt) 0. invoices
  in
  Printf.printf "invoices: %d\\n" (List.length invoices);
  Printf.printf "outstanding: %.2f\\n" outstanding;
  for i = 1 to 5 do Printf.printf "%d squared is %d\\n" i (i * i) done`,
  },
};

/**
 * Compile and run source remotely.
 * @param {string} langId key of REMOTE_LANGUAGES
 * @param {string} code
 * @param {{stdin?: string, signal?: AbortSignal}} [opts]
 * @returns {Promise<{ok: boolean, output: string, compileError: string, runtimeError: string, status: number|null, ms: number}>}
 */
export async function compileRemote(langId, code, { stdin = '', signal } = {}) {
  const lang = REMOTE_LANGUAGES[langId];
  if (!lang) throw new Error(`Unknown remote language: ${langId}`);

  const started = performance.now();
  const body = {
    compiler: lang.compiler,
    code,
    stdin,
    save: false,
  };
  if (lang.options) body['compiler-option-raw'] = lang.options.split(/\s+/).join('\n');

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    throw new Error(res.status === 429
      ? 'The compile service is rate limiting. Wait a moment and try again.'
      : `The compile service returned ${res.status}.`);
  }

  const data = await res.json();
  const ms = Math.round(performance.now() - started);

  return {
    // A non-zero status is a real failure the user needs to see, not an
    // exception to swallow — a failed compile is normal while writing code.
    ok: (data.status ?? '0') === '0',
    output: (data.program_output ?? data.program_message ?? '').replace(/\s+$/, ''),
    compileError: (data.compiler_error ?? '').replace(/\s+$/, ''),
    runtimeError: (data.program_error ?? '').replace(/\s+$/, ''),
    status: data.status != null ? Number(data.status) : null,
    signal: data.signal ?? null,
    ms,
  };
}
