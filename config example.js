var config = {}

/*
 ##############################################################################################################################
 ########################################################## READ ME ###########################################################
 ##############################################################################################################################
  *	Config Example
  *	Rename this file to config.js

 ##############################################################################################################################
 ########################################################## WARNING ###########################################################
 ##############################################################################################################################
  *	Database name cannot contain any spaces or special characters
  *	Prefix has to be at least one charcter long, up to a max of 5
  *	Do not change any of the properties whilst the bot is running
    (This may cause date corruption and create errors)

 ##############################################################################################################################
 ###################################################### GENERAL SETTINGS ######################################################
 ##############################################################################################################################
*/
config.token = ''; /*String for Bot token*/
config.owner = ''; /*Owner ID*/
config.password = ''; /*Encryption password*/
config.database = 'Spectre'; /*Database name. WARNING changing this will create a new database (the old one wont be deleted)*/
config.dbuser = 'root'; /*The user used to log into the database*/
config.dbpass = ''; /*The password used to log into the database*/
config.dbhost = 'localhost'; /*The hostname of the device hosting the database*/
config.prefix = '.'; /*Default command prefix*/

/*
 ##############################################################################################################################
 ####################################################### CACHE SETTINGS #######################################################
 ##############################################################################################################################
  *	These settings set the hard limit on the number of objects that can be stored in cache (In RAM Memory)
  *	Higher numbers will improve performance of servers (More storage will be prioritised for servers using the bot more actively)
  *	but will use more RAM
*/
config.messageLimit = 1000; /*The hard limit for the number of messages to cache per server*/

module.exports = config;
