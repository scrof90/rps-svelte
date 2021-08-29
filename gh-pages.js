var ghpages = require("gh-pages");

ghpages.publish(
  "public", // path to public directory
  {
    branch: "gh-pages",
    repo: "https://github.com/scrof90/rps-svelte.git", // Update to point to your repository
    user: {
      name: "Scrof", // update to use your name
      email: "asknyshev@gmail.com", // Update to use your email
    },
    dotfiles: true,
  },
  () => {
    console.log("Deploy Complete!");
  }
);
