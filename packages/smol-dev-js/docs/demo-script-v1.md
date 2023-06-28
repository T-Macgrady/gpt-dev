What does the following pokedex, and google chrome plugin have in common?

They are all fully generated by an AI, without a line of code, using markdown files written in English

Let me show you how.

Introducing smol-dev-JS

After installing via npm, you can set it up against either a new or existing JS project

The setup is a guided process which would ask you for your choice of anthropic or openAI and their api key. Where you can use the Claude or gpt4 model accordingly

For those who have Claude access it is highly recommended to use that instead, because of how much faster it is, otherwise we will try our best with gpt4-8k.

For a new project, after the initial setup. Describe your application with a README.md in the spec folder, for larger projects this would be the overall spec, and you can include file specific readme. Additionally if you want to include instructions to the AI that does not make sense or fit into the spec, you can do so with NOTES.md

Once your done you can get the ai to generate the code with the `code2spec`. 

You can then review it for issues and if there are bug and issues. You can either update the spec and regenerate the code.

Or you can switch over to prompt mode, when you can simply tell it what to do or place in error messages. And ask the AI to make the change.

Making changes as big, or as incremental as you want to. Looping until you have attained happiness with your project.

But what about existing projects?

You can use the same prompt mode to make small incremental changes. And have the specs mode fully disabled

Alternatively you can generate a draft of the specification via the code2spec command. Which can be used to help better guide the AI in making changes via the prompting mode

And that’s it … a glimpse of the future of coding where all you need is English or any other spoken language that the AI can understand.

While it ain’t perfect yet, because the AI can really make silly mistakes, you are always in control.
It is safe, and useful, it will never go out of control and make an AGI, as all it will do is help you with the coding task you assigned

You can revert any changes in the repo that was done badly, or manually take over if the AI is not being useful.

Until then, you have a smol developer to help offload some of the more boring tasks. Which you can scale drastically across multiple projects.

In fact for best results, treat it like a new junior dev who joined on day 1

Have no idea how do CSS animation. Ask the AI to do a prototype.

You do not know the api to Vue.js? But wants to migrate an angular site over. Ask it to give it a try.

Allowing you the dev to stay more in focused on the bigger picture, like a senior dev. While avoiding being stuck writing CRUD apis again