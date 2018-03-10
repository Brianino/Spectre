var config = {}

/*
  ######## READ ME ########
  *	Config Example
  *	Create a folder called "Files" within the Emote-Bro directory.
  *	Rename this file to config.js

  ######## WARNING ########
  * Database name cannot contain any spaces or special characters
  * Prefix has to be at least one charcter long, up to a max of 5
*/
config.token = ''; /*String for Bot token*/
config.owner = ''; /*Owner ID*/
config.password = ''; /*Encryption password*/
config.database = 'Spectre'; /*Database name. WARNING changing this will create a new database, but wont delete any existing ones*/
config.prefix = '.'; /*Default command prefix*/

module.exports = config;
