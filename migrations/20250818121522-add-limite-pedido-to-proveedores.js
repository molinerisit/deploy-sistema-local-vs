// En la carpeta /migrations, el archivo nuevo que se acaba de crear (CORREGIDO)
'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    // Añadimos la nueva columna a la tabla 'proveedores'
    await queryInterface.addColumn('proveedores', 'limitePedido', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down (queryInterface, Sequelize) {
    // Esto permite revertir el cambio si es necesario
    await queryInterface.removeColumn('proveedores', 'limitePedido');
  }
};