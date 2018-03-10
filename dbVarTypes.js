var field = {};

//GUILD INFO
field.g = 'Guilds';
field.gID = 'Guild_ID varchar(21)';
field.gPr = 'Prefix varchar(5)';

//USER INFO
field.u = 'Users';
field.uID = 'User_ID varchar(21)';
field.uNa = 'User_Name varchar(10)';
field.uRG = 'Role_Group_ID int';
field.uDe = 'Descriminator varchar(4)';

//ROLE INFO
field.r = 'Roles';
field.rID = 'Role_ID varchar(21)';
field.rNa = 'Role_Name varchar(10)';
field.rSe = 'Self_Role bool';

//MESSAGE INFO
field.m = 'Messages';
field.mID = 'Message_ID varchar(21)';
field.mCo = 'Message_Content text(2000)';
field.mEd = 'Edit bool';
field.mDe = 'Deleted bool';
field.mCm = 'Command bool';
field.mOm = 'Unedited_ID varchar(21)';
field.mOb = 'Message_Object blob';

//CHANNEL INFO
field.c = 'Channels';
field.cID = 'Channel_ID varchar(21)';
field.cNa = 'Channel_Name varchar(20)';
field.cLo = 'Log bool';
field.cBl = 'Blacklisted bool';
field.cPa = 'Party_Chat bool';

//PERM (DISCORD) INFO
field.p = 'Perms';
field.pID = 'Perm_ID int';
field.pNa = 'Perm_Name varchar(40)';
field.pBi = 'Perm_Bitfield int';

//MODULE INFO
field.mod = 'Modules';
field.modID = 'Module_ID int';
field.modNa = 'Module_Name varchar(20)';
field.modDe = 'Module_Description varchar(100)';
field.modUs = 'Module_Usage varchar(20)';
field.modAu = 'Atomation bool';
field.modGl = 'Global bool';
field.modFi = 'Fixed bool';

//FILTER INFO
field.fil = 'Filters';
field.filID = 'Filter_ID int';
field.filTa = 'Filter_Tag varchar(10)';
field.filFi = 'Filter varchar(100)';

//WARNING INFO
field.war = 'Warnings';
field.warID = 'Warning_ID int';
field.warRe = 'Warning_Reason varchar(100)';
field.warLi = 'Image_Link varchar(20)';
field.warGr = 'Message_Group int';
field.warBa = 'Is_Ban bool';

//OTHER
field.GRr = 'Role_Group';
field.GRp = 'Perm_Group';
field.GRp = 'Filter_Group';
field.GRw = 'Warning_Group';
field.GRm = 'Enabled_Modules';
field.GRb = 'Blocked_Users';
field.GRID = 'Group_ID int';
field.Tim = 'Time datetime';
field.iTi = 'Timeout bool';

//CONTRAINTS
field.pk = 'PRIMARY KEY';
field.fk = 'FOREIGN KEY';
field.nn = 'NOT NULL';
field.un = 'UNIQUE';
field.ch = 'CHECK';
field.df = 'DEFAULT';
field.IN = 'INDEX';
field.in = 'AUTO_INCREMENT';

module.exports = field;