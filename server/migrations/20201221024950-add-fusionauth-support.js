'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('teams', 'fusionauthId', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('teams', 'fusionauthId');
  }
};
