console.log('argv1=', JSON.stringify(process.argv[1]));
console.log('meta.url=', import.meta.url);
console.log('computed=', `file://${process.argv[1].replace(/\\/g, '/')}`);
console.log('match=', import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`);