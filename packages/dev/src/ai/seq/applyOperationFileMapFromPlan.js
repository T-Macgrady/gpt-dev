// Core deps
const fs = require("fs")
const path = require('path')
const child_process = require("child_process")
const simplePrompt = require("../../cli/simplePrompt");
const getSpecDirPath = require("../../core/getSpecDirPath");
const getSrcDirPath = require("../../core/getSrcDirPath");

// Prompt builder deps
const getPromptBlock = require("../../prompt/builder/getPromptBlock");
const getMainDevSystemPrompt = require("../../prompt/part/getMainDevSystemPrompt");
const jsonObjectChatCompletion = require("../call/jsonObjectChatCompletion");
const getLocalDepSummary = require("./getLocalDepSummary");
const updateFileWithPlan = require("./updateFileWithPlan");
const prepareCommonContext = require("./prepareCommonContext");
const updateSpecSrcFilePair = require("./updateSpecSrcFilePair");

/**
 * Given the current plan, and the operation map, execute it
 */
module.exports = async function getOperationFileMapFromPlan(currentPlan, operationMap, promptHistory=[]) {
 
	// // Example of operationMap
	// {
	// 	'0_NPM_DEP_INSTALL': [],
	// 	'1_MOVE_SRC': {},
	// 	'1_MOVE_SPEC': {},
	// 	'2_DEL_SRC': [],
	// 	'2_DEL_SPEC': [],
	// 	'3_UPDATE_SRC': [ 'mainCLI.js', 'cli/command/code2spec.js' ],
	// 	'3_UPDATE_SPEC': [ 'README.md' ],
	// 	'4_UPDATE_SRC': [],
	// 	'4_UPDATE_SPEC': [],
	// 	LOCAL_DEP: [ 'util/scanDirectory.js', 'core/ai.js' ]
	// }

	// Lets get the local dep summary, in parallel
	let localDepList = operationMap["LOCAL_DEP"] || [];

	// Log it
	console.log(`🐣 [ai]: Studying ${localDepList.length} dependencies (in parallel)`)

	// Work on it
	let localDepSummaryMap = {};
	let localDepSummaryPromiseArr = [];
	if (localDepList && localDepList.length > 0) {
		// Lets get the local dep summary, in parallel
		let localDepSummaryMap = {};
		localDepSummaryPromiseArr = localDepList.map(async (localDepPath) => {
			// Get the local dep summary
			let localDepSummary = await getLocalDepSummary(localDepPath);
			localDepSummaryMap[localDepPath] = localDepSummary;
		});
	}

	// Log the reflecting state
	console.log(`🐣 [ai]: Performing any required modules install / file moves / deletion`)

	// Lets handle the NPM installs
	let npmInstallArr = operationMap["0_NPM_DEP_INSTALL"];
	if (npmInstallArr && npmInstallArr.length > 0) {
		// Prompt injection safety, confirm with user first
		console.log(`Confirm the excution of 'npm install ${npmInstallArr.join(" ")}'`)
		simplePrompt({
			type: "confirm",
			name: "approve",
			message: "[you]: Install listed dependencies?",
			initial: true
		})

		// Execute the npm install commands
		// TODO: handle install fail, This is a bit of a hack, but it works for now 
		// child_process.spawnSync(`npm install ${npmInstallArr.join(" ")}`, { cwd: process.cwd() });
	}

	// Lets get the src and spec dir paths
	let specDir = getSpecDirPath();
	let srcDir = getSrcDirPath();

	// Lets handle the file moves of the src dir
	let moveSrcMap = operationMap["1_MOVE_SRC"];
	if(moveSrcMap) {
		for (let oldPath in moveSrcMap) {
			let fullOldPath = path.resolve(srcDir, oldPath)
			let fullNewPath = path.resolve(srcDir, moveSrcMap[oldPath]);

			// Operation safety!!! - Check if the old and new path ARE within the src dir
			if (!fullOldPath.startsWith(srcDir)) {
				throw new Error(`The old path '${fullOldPath}' is not within the src dir '${srcDir}'`)
			}
			if (!fullNewPath.startsWith(srcDir)) {
				throw new Error(`The new path '${fullNewPath}' is not within the src dir '${srcDir}'`)
			}

			// Move it
			renameIfExist(fullOldPath, fullNewPath);
		}
	}

	// Lets handle the file moves of the spec dir
	let moveSpecMap = operationMap["1_MOVE_SPEC"];
	if(moveSpecMap) {
		for (let oldPath in moveSpecMap) {
			let fullOldPath = path.resolve(specDir, oldPath)
			let fullNewPath = path.resolve(specDir, moveSpecMap[oldPath]);

			// Operation safety!!! - Check if the old and new path ARE within the spec dir
			if (!fullOldPath.startsWith(specDir)) {
				throw new Error(`The old path '${fullOldPath}' is not within the spec dir '${specDir}'`)
			}
			if (!fullNewPath.startsWith(specDir)) {
				throw new Error(`The new path '${fullNewPath}' is not within the spec dir '${specDir}'`)
			}

			// Move it
			renameIfExist(fullOldPath, fullNewPath);
		}
	}

	// Lets handle the file deletes of the src dir
	let delSrcArr = operationMap["2_DEL_SRC"];
	if(delSrcArr && delSrcArr.length > 0) {
		for (let _path of delSrcArr) {
			let fullPath = path.resolve(srcDir, _path)

			// Operation safety!!! - Check if the path IS within the src dir
			if (!fullPath.startsWith(srcDir)) {
				throw new Error(`The path '${fullPath}' is not within the src dir '${srcDir}'`)
			}

			// Delete it
			await fs.promises.unlink( fullPath );
		}
	}

	// Lets handle the file deletes of the spec dir
	let delSpecArr = operationMap["2_DEL_SPEC"];
	if(delSpecArr && delSpecArr.length > 0) {
		for (let path of delSpecArr) {
			let fullPath = path.resolve(specDir, path)

			// Operation safety!!! - Check if the path IS within the spec dir
			if (!fullPath.startsWith(specDir)) {
				throw new Error(`The path '${fullPath}' is not within the spec dir '${specDir}'`)
			}

			// Delete it
			await fs.promises.unlink( fullPath );
		}
	}

	// Log it
	console.log(`🐣 [ai]: Studying ${localDepList.length} dependencies (awaiting in parallel)`)

	// Lets await for all the local dep summary promises to finish
	await Promise.all(localDepSummaryPromiseArr);

	// Log it
	console.log(`🐣 [ai]: Preparing summaries for smol-er sub-operations ...`)

	// Lets build the local dep summary string
	let localDepSummaryArr = [];
	for(let localDepPath in localDepSummaryMap) {
		localDepSummaryArr.push(getPromptBlock(
			`Some info about ${localDepPath}`,
			localDepSummaryMap[localDepPath]
		));
	}
	let localDepSummaryStrSet = localDepSummaryArr.join("\n\n").trim();

	// Promise array for async operations
	let asyncOpPromiseArr = [];

	// Lets build the common context
	let commonContext = await prepareCommonContext(
		currentPlan,
		[operationMap["3_UPDATE_SRC"], operationMap["4_UPDATE_SRC"]].flat().filter((a)=>{return a != null}), 
		localDepSummaryStrSet,
		promptHistory
	);

	// Lets handle the file updates of the src dir
	let updateSrcArr = operationMap["3_UPDATE_SRC"];
	if(updateSrcArr && updateSrcArr.length > 0) {
		for(const srcFile of updateSrcArr) {
			console.log(`🐣 [ai]: (async) Updating src file - ${srcFile}`)
			asyncOpPromiseArr.push(
				updateFileWithPlan("src", srcFile, currentPlan, localDepSummaryStrSet, commonContext)
			);
		}
	}

	// Lets handle the file updates of the spec dir
	if( specDir ) {
		let updateSpecArr = operationMap["3_UPDATE_SPEC"];
		if(updateSpecArr && updateSpecArr.length > 0) {
			for(const specFile of updateSpecArr) {
				console.log(`🐣 [ai]: (async) Updating spec file - ${specFile}`)
				asyncOpPromiseArr.push(
					updateFileWithPlan("spec", specFile, currentPlan, localDepSummaryStrSet, commonContext)
				)
			}
		}

		// Wait for most the updates to complete
		await Promise.all(asyncOpPromiseArr);
		asyncOpPromiseArr = [];

		// // Update the spec files, for src codes that were updated
		// if(updateSrcArr && updateSrcArr.length > 0) {
		// 	for(const srcFile of updateSrcArr) {
		// 		asyncOpPromiseArr.push(
		// 			updateSpecSrcFilePair("spec", srcFile+".md")
		// 		);
		// 	}
		// }
	}

	// Lets await for all the async operations to finish
	await Promise.all(asyncOpPromiseArr);
	asyncOpPromiseArr = [];

	console.log(`🐣 [ai]: Finished current set of async spec/src file update (1st round)`)

	// Lets handle the file updates of the src dir
	let updateSrcArr_rd2 = operationMap["4_UPDATE_SRC"];
	if(updateSrcArr_rd2 && updateSrcArr_rd2.length > 0) {
		for(const srcFile of updateSrcArr_rd2) {
			console.log(`🐣 [ai]: (async) Updating src file - ${srcFile}`)
			asyncOpPromiseArr.push(
				updateFileWithPlan("src", srcFile, currentPlan, localDepSummaryStrSet, commonContext)
			);
		}
	}

	// Lets handle the file updates of the spec dir
	if( specDir ) {
		// Lets handle the file updates of the spec dir
		let updateSpecArr_rd2 = operationMap["4_UPDATE_SPEC"];
		if(updateSpecArr_rd2 && updateSpecArr_rd2.length > 0) {
			for(const specFile of updateSpecArr_rd2) {
				console.log(`🐣 [ai]: (async) Updating spec file - ${specFile}`)
				asyncOpPromiseArr.push(
					updateFileWithPlan("spec", specFile, currentPlan, localDepSummaryStrSet, commonContext)
				)
			}
		}

		// Wait for most the updates to complete
		await Promise.all(asyncOpPromiseArr);
		asyncOpPromiseArr = [];

		// // Update the spec files, for src codes that were updated
		// if(updateSrcArr_rd2 && updateSrcArr_rd2.length > 0) {
		// 	for(const srcFile of updateSrcArr_rd2) {
		// 		asyncOpPromiseArr.push(
		// 			updateSpecSrcFilePair("spec", srcFile+".md")
		// 		);
		// 	}
		// }
	}

	// Lets await for all the async operations to finish
	await Promise.all(asyncOpPromiseArr);
	console.log(`🐣 [ai]: Finished current set of async spec/src file update (2nd round)`)

}

function renameIfExist(srcFile, destFile) {
	if( fs.existsSync(srcFile) ) {
		fs.renameSync(srcFile, destFile);
	} else {
		console.log(`🐣 [ai]: File ${srcFile} does not exist, skipping rename!!!!!!!!!`)
	}
}