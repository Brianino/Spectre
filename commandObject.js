Module.export = (function () {
	var commands = {}, obj = {};

	commands.help = function (param) {
		var embedobj = {};

		embedobj = {
			"title" : "All Available Commands",
			"color" : 0xFF0000,
			"fields" : []
		};
		if ('command' in param && 'msg' in param && 'perm' in param) {
			var description = '', usage = '', prefix = '.';
			//db will store perms
			//get prefix from db
			if ('perm' in commands[param.command]) {
				if (param.perm < commands[param.command].perm) {
					//user does not have perms
					throw {
						'name' : 'inavalid perms',
						'message' : 'do not have the required perms to run the command'
					}
				}
			}
			embedobj.title = param.command;
			if (param.command in commands) {
				if ('description' in commands[param.command]) {
					description = commands[param.command].description;
				} else {
					description = 'no description';
				}
				if ('usage' in commands[param.command]) {
					usage = commands[param.command].usage;
				} else {
					usage = 'no usage template';
				}
				embedobj.description = "Description: " + commands[param.command].description + "\n" +
					"Usage: " + prefix + usage + "\n" +
					"[] = required input\n"
					"<> = optional input";
			} else {
				embedobj.description = "Command Doesnt Exist";
			}
		} else {
			for (var prop in commands) {
				//verify perm level
				//get perm lvl from db
				embedobj.fields.push({
					"name" : prefix + prop,
					"value" : commands[prop].description,
					"inline" : false
				});
				}
			}
		}
	}
	obj.assign = function (name, props, func) {
		try {
			if (!(name in commands)) {
				commands.name = {};
			}
			for (var prop in props) {
				commands.name.func = props.prop;
			}
			commands.name.func = func;
		} catch (e) {
			console.log('Error in commandObj.js/assign: ${e.message}');
		}
	}
	obj.run = function (name, param) {
		if (name in commands) {
			//turn this into promise to multi-thread commands
			commands[name](param);
		} else {
			throw {
				'name' : 'command error',
				'message' : '${name} is not a valid command'
			};
		}
	}
})();