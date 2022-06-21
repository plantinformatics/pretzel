module.exports = function(app) {
    let dataSource = process.env.NODE_ENV === "test" ?
        app.dataSources.db :
        app.dataSources.mongoDs;
    let model_list = [];
    Object.keys(dataSource.models).forEach(function(model) {
        model_list.push(dataSource.models[model].modelName);
    })
    dataSource.isActual(model_list, function(err, actual) {
        if (!actual) {
            console.log('Database appears to be out of sync with loopback models');
        };
    });
    // dataSource.autoupdate('Alias', function(err, result) {
    //     console.log(err, result);
    // });
}
