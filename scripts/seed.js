// Keep the documented positional entrypoint compatible with the flag-based CLI.
import('./seed.mjs')
  .then(({ main }) => main())
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
