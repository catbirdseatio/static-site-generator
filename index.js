import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { marked } from "marked";
import ejs from "ejs";
import mkdirp from "mkdirp";
import fg from "fast-glob";

const marked_options = {
  headerIds: false,
  breaks: true,
};

// Replace '&gt;' and '&lt;' with '>' and '<'
const remove_entities = (html_string) =>
  html_string
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\\n/g, "<br>");

const read_file = async (filename) => {
  try {
    const rawFile = await fs.readFile(filename, "utf-8");
    const parsed = matter(rawFile);
    const html = marked(parsed.content, marked_options);
    return { ...parsed, html };
  } catch (error) {
    console.log(error);
  }
};

// Inject content and data into a template for a new html formatted file.
const templatize = (template, file_data) => {
  const content = remove_entities(file_data.html);

  // Replace content ejs tag with the actual content
  template = remove_entities(template).replace("<%= content %>", content);
  
  // Build the output string
  const template_output = ejs.render(template, { ...file_data.data });
  return remove_entities(template_output);
};

// Save contents string to a filename path.
const save_file = async (filename, contents) => {
  try {
    const dir = path.dirname(filename);
    mkdirp.sync(dir);
    fs.writeFile(filename, contents);
  } catch (error) {
    console.log(error);
  }
};

// Get an new output file from an existing one. Default output extension
//    is html.
const get_output_filename = (filename, out_path, extension = "html") => {
  const basename = path.basename(filename);
  const new_filename = basename.split(".")[0];
  const outfile = path.join(out_path, new_filename);
  return `${outfile}.${extension}`;
};

const process_file = async (filename, template, outpath) => {
  const out_filename = get_output_filename(filename, outpath);

  try {
    const output = await read_file(filename);
    const data = { content: output.html, ...output };
    const templatized = templatize(template, data);
    await save_file(out_filename, templatized);
  } catch (error) {
    console.log(error);
  }
};


(async () => {
  const src_path = path.join(path.resolve("src"));
  const target_path = path.join(path.resolve("dist"));
  const page_template = await fs.readFile(
    path.join(src_path, "layouts", "layout.html"),
    "utf-8"
  );

  // Write a source asset (css, js) to the target directory
  // Function must be defined inside the IIFE to use the target directory variable
  const process_asset = async (asset) => {
    // create a new path
    const extension = asset.split(".").pop();
    const asset_path = path.join(target_path, extension);
    const new_filename = get_output_filename(asset, asset_path, extension);
    console.log(new_filename);
  
    // get contents of files
    const contents = await fs.readFile(asset);
  
    // write file to path
    save_file(new_filename, contents);
  }

  // Process an image file
  // This function is similar to, but very different from process_asset
  const process_image = async (image) => {
    // create a new path
    const extension = image.split(".").pop();
    const image_path = path.join(target_path, 'img');
    const new_filename = get_output_filename(image, image_path, extension);
  
    // get contents of files
    const contents = await fs.readFile(image);
  
    // write file to path
    save_file(new_filename, contents);
  }

  // Get src assets
  const filenames = fg.sync(src_path + "/pages/**/*.md");
  const assets = fg.sync(src_path + "/**/*.{css,js}");
  const images = fg.sync(src_path + "/**/*.{jpg, png, gif}");

  // Save assets to the dist folder
  assets.forEach(process_asset);
  images.forEach(process_image);

  // write the pages
  filenames.forEach(
    async (filename) => await process_file(filename, page_template, target_path)
  );
})();
