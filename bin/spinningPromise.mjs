import ora from 'ora';

export default function spinningPromise (text, factory) {
  const spinner = ora();

  spinner.start(text);

  return factory()
    .then((val) => {
      spinner.succeed();
      return val;
    })
    .catch((err) => {
      spinner.fail();
      throw err;
    });
}
