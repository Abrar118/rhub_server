const arr = [1, 2, 3, 4];
const average = Math.floor(arr.reduce((acc, cur) => acc + cur, 0) / arr.length);
console.log(average);
export {};
