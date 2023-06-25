const { Configuration, OpenAIApi } = require("openai");

/* global exports */
/* global require */


/**
 * initially based on example : https://platform.openai.com/examples/default-text-to-command
 */

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);


//------------------------------------------------------------------------------

const prompt = 
"\
Act as the user interface for an genomic application which can :\
1. display datasets containing genes or markers on axes which correspond to chromosomes\
2. search for DNA sequence in reference assemblies and display the matched positions on the axes\
3. search for genes and markers by name and display their positions on the axes\
4. zoom into a region defined by positions of genes or markers or DNA sequence search results.\
Reference assemblies are referred to by the species or variety name, and a version.\
Reply with these commands corresponding to the above actions :\
1. display(dataset, chromosome), where chromosome is a name such as 1A, ... 7D.\
2. dna_search(dna sequence text, reference assembly name).\
3. position_interval = gene_or_marker_search(gene_or_marker_name).\
4. zoom(start_position, end_position).\
Interpret the following user request and express it in the form of the above commands.\
 --- \
";

//------------------------------------------------------------------------------

exports.text2Commands = text2Commands;
async function text2Commands(text /*: string*/) {
  const fnName = 'text2Commands';
  /// trim off trailing newlines
  text = text.replaceAll(/\n+$/g, '');
  const response = await openai.createCompletion({
    model: "text-davinci-003",
    prompt : prompt + text,
    temperature: 0,
    max_tokens: 100,
    top_p: 1.0,
    frequency_penalty: 0.2,
    presence_penalty: 0.0,
    // stop: ["\n"],
  });
  const result = response?.data?.choices?.[0]?.text;
  console.log(fnName, result);
  return result;
}

