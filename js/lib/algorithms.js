/* ============================================================
   Algorithm traces.

   Every algorithm here is written as a generator that yields a frame
   after each meaningful step. That keeps the visualisation honest: the
   picture is produced by the algorithm actually running, not by a
   hand-drawn animation that happens to look right.

   A frame describes what to draw and why:
     { array, compare, swap, sorted, pivot, range, note }
   ============================================================ */

const frame = (array, extra = {}) => ({ array: [...array], ...extra });

/* ---------------- sorting ---------------- */

export function* bubbleSort(a) {
  const arr = [...a];
  const n = arr.length;
  const sorted = [];
  yield frame(arr, { note: 'Compare each neighbouring pair and swap them if they are out of order.' });

  for (let i = 0; i < n - 1; i++) {
    let swapped = false;
    for (let j = 0; j < n - i - 1; j++) {
      yield frame(arr, { compare: [j, j + 1], sorted: [...sorted], note: `Is ${arr[j]} greater than ${arr[j + 1]}?` });
      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
        swapped = true;
        yield frame(arr, { swap: [j, j + 1], sorted: [...sorted], note: `Yes — swap them.` });
      }
    }
    sorted.unshift(n - i - 1);
    yield frame(arr, { sorted: [...sorted], note: `${arr[n - i - 1]} is now in its final position.` });
    // The early exit is the whole reason bubble sort is O(n) on sorted input.
    if (!swapped) {
      yield frame(arr, { sorted: arr.map((_, k) => k), note: 'A full pass with no swaps — the list is already sorted.' });
      return;
    }
  }
  yield frame(arr, { sorted: arr.map((_, k) => k), note: 'Sorted.' });
}

export function* insertionSort(a) {
  const arr = [...a];
  yield frame(arr, { note: 'Take each item and slide it back into the sorted part on the left.' });

  for (let i = 1; i < arr.length; i++) {
    const key = arr[i];
    let j = i - 1;
    yield frame(arr, { compare: [i], sorted: Array.from({ length: i }, (_, k) => k), note: `Insert ${key} into the sorted left-hand side.` });
    while (j >= 0 && arr[j] > key) {
      arr[j + 1] = arr[j];
      yield frame(arr, { swap: [j, j + 1], sorted: Array.from({ length: i }, (_, k) => k), note: `${arr[j]} is bigger than ${key}, shift it right.` });
      j--;
    }
    arr[j + 1] = key;
    yield frame(arr, { sorted: Array.from({ length: i + 1 }, (_, k) => k), note: `${key} settles at position ${j + 2}.` });
  }
  yield frame(arr, { sorted: arr.map((_, k) => k), note: 'Sorted.' });
}

export function* selectionSort(a) {
  const arr = [...a];
  yield frame(arr, { note: 'Find the smallest remaining item and move it to the front.' });

  for (let i = 0; i < arr.length - 1; i++) {
    let min = i;
    for (let j = i + 1; j < arr.length; j++) {
      yield frame(arr, { compare: [min, j], sorted: Array.from({ length: i }, (_, k) => k), note: `Is ${arr[j]} smaller than ${arr[min]}?` });
      if (arr[j] < arr[min]) min = j;
    }
    if (min !== i) {
      [arr[i], arr[min]] = [arr[min], arr[i]];
      yield frame(arr, { swap: [i, min], sorted: Array.from({ length: i }, (_, k) => k), note: `Move ${arr[i]} to position ${i + 1}.` });
    }
    yield frame(arr, { sorted: Array.from({ length: i + 1 }, (_, k) => k), note: `Position ${i + 1} is settled.` });
  }
  yield frame(arr, { sorted: arr.map((_, k) => k), note: 'Sorted.' });
}

export function* mergeSort(a) {
  const arr = [...a];
  yield frame(arr, { note: 'Split the list down to single items, then merge the pieces back in order.' });

  function* sort(lo, hi) {
    if (hi - lo < 1) return;
    const mid = Math.floor((lo + hi) / 2);
    yield frame(arr, { range: [lo, hi], note: `Split positions ${lo + 1}–${hi + 1}.` });
    yield* sort(lo, mid);
    yield* sort(mid + 1, hi);

    const merged = [];
    let i = lo, j = mid + 1;
    while (i <= mid && j <= hi) {
      yield frame(arr, { compare: [i, j], range: [lo, hi], note: `Which is smaller, ${arr[i]} or ${arr[j]}?` });
      merged.push(arr[i] <= arr[j] ? arr[i++] : arr[j++]);
    }
    while (i <= mid) merged.push(arr[i++]);
    while (j <= hi) merged.push(arr[j++]);

    for (let k = 0; k < merged.length; k++) arr[lo + k] = merged[k];
    yield frame(arr, { range: [lo, hi], note: `Merged positions ${lo + 1}–${hi + 1}.` });
  }

  yield* sort(0, arr.length - 1);
  yield frame(arr, { sorted: arr.map((_, k) => k), note: 'Sorted.' });
}

export function* quickSort(a) {
  const arr = [...a];
  const done = [];
  yield frame(arr, { note: 'Pick a pivot, move smaller items left and larger right, then repeat on each side.' });

  function* sort(lo, hi) {
    if (lo >= hi) {
      if (lo === hi) { done.push(lo); yield frame(arr, { sorted: [...done], note: `Single item at position ${lo + 1} is settled.` }); }
      return;
    }
    const pivot = arr[hi];
    yield frame(arr, { pivot: hi, range: [lo, hi], sorted: [...done], note: `Pivot is ${pivot}.` });

    let i = lo;
    for (let j = lo; j < hi; j++) {
      yield frame(arr, { compare: [j, hi], pivot: hi, range: [lo, hi], sorted: [...done], note: `Is ${arr[j]} below the pivot ${pivot}?` });
      if (arr[j] < pivot) {
        if (i !== j) {
          [arr[i], arr[j]] = [arr[j], arr[i]];
          yield frame(arr, { swap: [i, j], pivot: hi, range: [lo, hi], sorted: [...done], note: 'Move it into the smaller group.' });
        }
        i++;
      }
    }
    [arr[i], arr[hi]] = [arr[hi], arr[i]];
    done.push(i);
    yield frame(arr, { swap: [i, hi], sorted: [...done], note: `Pivot ${pivot} lands at position ${i + 1} — its final home.` });

    yield* sort(lo, i - 1);
    yield* sort(i + 1, hi);
  }

  yield* sort(0, arr.length - 1);
  yield frame(arr, { sorted: arr.map((_, k) => k), note: 'Sorted.' });
}

export function* heapSort(a) {
  const arr = [...a];
  const n = arr.length;
  const sorted = [];
  yield frame(arr, { note: 'Build a max-heap, then repeatedly move the largest item to the end.' });

  function* sift(size, root) {
    let largest = root;
    const l = 2 * root + 1, r = 2 * root + 2;
    if (l < size) { yield frame(arr, { compare: [largest, l], sorted: [...sorted], note: `Compare with left child.` }); if (arr[l] > arr[largest]) largest = l; }
    if (r < size) { yield frame(arr, { compare: [largest, r], sorted: [...sorted], note: `Compare with right child.` }); if (arr[r] > arr[largest]) largest = r; }
    if (largest !== root) {
      [arr[root], arr[largest]] = [arr[largest], arr[root]];
      yield frame(arr, { swap: [root, largest], sorted: [...sorted], note: 'Push the larger value up.' });
      yield* sift(size, largest);
    }
  }

  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) yield* sift(n, i);
  yield frame(arr, { note: 'The largest value is now at the top of the heap.' });

  for (let i = n - 1; i > 0; i--) {
    [arr[0], arr[i]] = [arr[i], arr[0]];
    sorted.unshift(i);
    yield frame(arr, { swap: [0, i], sorted: [...sorted], note: `Move ${arr[i]} to its final position.` });
    yield* sift(i, 0);
  }
  yield frame(arr, { sorted: arr.map((_, k) => k), note: 'Sorted.' });
}

/* ---------------- searching ---------------- */

export function* linearSearch(a, target) {
  const arr = [...a];
  yield frame(arr, { note: `Looking for ${target} by checking every item in turn.` });
  for (let i = 0; i < arr.length; i++) {
    yield frame(arr, { compare: [i], note: `Is ${arr[i]} the value ${target}?` });
    if (arr[i] === target) {
      yield frame(arr, { sorted: [i], note: `Found ${target} at position ${i + 1} after ${i + 1} checks.` });
      return;
    }
  }
  yield frame(arr, { note: `${target} is not in the list. Every one of the ${arr.length} items was checked.` });
}

export function* binarySearch(a, target) {
  const arr = [...a].sort((x, y) => x - y);
  let lo = 0, hi = arr.length - 1, steps = 0;
  yield frame(arr, { range: [lo, hi], note: `Binary search needs sorted input, so the list is sorted first. Looking for ${target}.` });

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    steps++;
    yield frame(arr, { compare: [mid], range: [lo, hi], note: `Middle of the range is ${arr[mid]}.` });
    if (arr[mid] === target) {
      yield frame(arr, { sorted: [mid], note: `Found ${target} in ${steps} steps. A linear scan would have taken up to ${arr.length}.` });
      return;
    }
    if (arr[mid] < target) { lo = mid + 1; yield frame(arr, { range: [lo, hi], note: `${arr[mid]} is too small — discard the left half.` }); }
    else { hi = mid - 1; yield frame(arr, { range: [lo, hi], note: `${arr[mid]} is too big — discard the right half.` }); }
  }
  yield frame(arr, { note: `${target} is not in the list. Ruled out in ${steps} steps.` });
}

/* ---------------- catalogue ---------------- */

export const ALGORITHMS = {
  bubble: {
    name: 'Bubble sort', group: 'Sorting', fn: bubbleSort,
    best: 'O(n)', average: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: true,
    about: 'Repeatedly walks the list swapping neighbours. Rarely used in practice, but it stops early on an already-sorted list, which is why its best case is linear.',
  },
  insertion: {
    name: 'Insertion sort', group: 'Sorting', fn: insertionSort,
    best: 'O(n)', average: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: true,
    about: 'Builds a sorted section one item at a time. Genuinely fast on small or nearly-sorted lists, which is why real sort implementations switch to it for short runs.',
  },
  selection: {
    name: 'Selection sort', group: 'Sorting', fn: selectionSort,
    best: 'O(n²)', average: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: false,
    about: 'Finds the smallest remaining item each pass. Always does the same number of comparisons, but the fewest possible swaps — useful when writing is expensive.',
  },
  merge: {
    name: 'Merge sort', group: 'Sorting', fn: mergeSort,
    best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n log n)', space: 'O(n)', stable: true,
    about: 'Splits, sorts each half, then merges. Predictable at every input and stable, at the cost of extra memory.',
  },
  quick: {
    name: 'Quicksort', group: 'Sorting', fn: quickSort,
    best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n²)', space: 'O(log n)', stable: false,
    about: 'Partitions around a pivot. Usually the fastest in practice, but a badly chosen pivot on already-sorted data degrades it to quadratic.',
  },
  heap: {
    name: 'Heap sort', group: 'Sorting', fn: heapSort,
    best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n log n)', space: 'O(1)', stable: false,
    about: 'Builds a max-heap, then pulls the largest item off repeatedly. Guaranteed n log n with no extra memory, but poor cache behaviour makes it slower than quicksort in reality.',
  },
  linear: {
    name: 'Linear search', group: 'Searching', fn: linearSearch, needsTarget: true,
    best: 'O(1)', average: 'O(n)', worst: 'O(n)', space: 'O(1)', stable: null,
    about: 'Checks every item until it finds a match. The only option when the data is unsorted.',
  },
  binary: {
    name: 'Binary search', group: 'Searching', fn: binarySearch, needsTarget: true,
    best: 'O(1)', average: 'O(log n)', worst: 'O(log n)', space: 'O(1)', stable: null,
    about: 'Halves the search range each step. Requires sorted input — the reason it is worth keeping a list sorted at all.',
  },
};
