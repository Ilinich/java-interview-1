const Converter = require("showdown").Converter;

const Logger = require("./logger");
const Speller = require("./speller");

const converter = new Converter({tables: true});
const EOL = "\r\n";
const dirName = __dirname + "/../";

class Transformer {

	constructor(fs, pr, logger) {
		this.fs = fs || require("./fs");
		this.pr = pr || require("./parser")
		this.logger = logger || new Logger();
		this.sp = new Speller(JSON.parse(this.fs.readFile(dirName + "/.yaspellerrc")));
	}

	transformRootFile(rootFileName, mdFilesContents) {
		let readMeContents = [];

		readMeContents.push("## Интеллект-карта");
		readMeContents.push("[![mindmap](./img/mindmap.png)](./mindmap)");
		readMeContents.push("");
		readMeContents.push("## Пройти опрос");
		readMeContents.push("[![mindmap](./img/quiz.png)](./quiz)");
		readMeContents.push("");
		readMeContents.push("## Оглавление");

		mdFilesContents.forEach(mdFileContent => readMeContents.push(this.pr.mapHeaderToLink(mdFileContent.articleName)));

		readMeContents.push("");

		mdFilesContents.forEach((mdFileContent) => {
			readMeContents.push("## " + mdFileContent.articleName);

			mdFileContent.questions.forEach(q => readMeContents.push(this.pr.mapHeaderAndAnchorToLink(q.title, q.anchor, mdFileContent.fileName)));
			readMeContents.push("");

			readMeContents.push("[к оглавлению](#вопросы-для-собеседования-на-разработчика-java)");
			readMeContents.push("");
			readMeContents.push("Проект основан на [enhorse/java-interview](https://github.com/enhorse/java-interview)");
		});

		let startTime = new Date().getTime();
		this.fs.writeFileContent(rootFileName, readMeContents.join(EOL))
			.then(() => this.logger.infoFile(rootFileName, startTime)).catch(e => this.logger.error(e));
	}

	transform(mdFile) {
		let promises = [];
		let startTime = new Date().getTime();
		let fileSource = this.fs.readFile(mdFile);

		promises.push(new Promise(async (resolve) => {
			let errors = await this.sp.check(fileSource, mdFile);
			resolve({fileName: mdFile, errors: errors});
		}));

		let fileContent = this.pr.splitIntoLines(fileSource);
		let articleName = this.pr.getArticleName(fileContent);
		let questions = this.pr.getQuestions(fileContent);
		let newFileContent = this.pr.replaceTableOfContent(fileContent, questions.map(q => this.pr.mapHeaderAndAnchorToLink(q.title, q.anchor))).join(EOL);

		promises.push(new Promise(async (resolve) => {
				let errors = [];
				try {
					await this.fs.writeFileContent(mdFile, newFileContent);
				} catch (e) {
					errors.push(e);
				}
				resolve({fileName: mdFile, errors: errors});
			})
		);

		this.logger.infoFile(mdFile, startTime);

		let mdFileName = mdFile.split("/")

		return {
			fileName: mdFileName[mdFileName.length - 1],
			articleName: articleName,
			questions: questions,
			promises: promises
		}
	}

	persistStructure(moduleFileName, mdFilesContents) {
		let startTime = new Date().getTime();

		let content = mdFilesContents.reduce((accumulator, current) => {
			return accumulator.concat(current.questions.map(q => {
				return {
					subject: current.articleName,
					url: current.fileName.split(".")[0] + ".html" + q.anchor,
					title: converter.makeHtml(q.title),
					answer: q.body ? converter.makeHtml(q.body) : ""
				};
			}));
		}, []);

		let data = "module.exports =" + JSON.stringify(content) + ";";
		this.fs.writeFileContent(moduleFileName, data)
			.then(() => this.logger.infoFile(moduleFileName, startTime)).catch(e => this.logger.error(e));
	}

}

module.exports = Transformer;