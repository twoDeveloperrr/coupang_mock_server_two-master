const express = require('express');
const compression = require('compression');
const methodOverride = require('method-override');

var cors = require('cors');
module.exports = function () {
    const app = express();

    app.use(compression());

    app.use(express.json());

    app.use(express.urlencoded({extended: true}));

    app.use(methodOverride());

    app.use(cors());
    // app.use(express.static(process.cwd() + '/public'));

    /* App (Android, iOS) */
    require('../src/app/routes/userRoute')(app);

    require('../src/app/routes/productRoute')(app);

    require('../src/app/routes/reviewRoute')(app);

    require('../src/app/routes/orderRoute')(app);

    require('../src/app/routes/cartRoute')(app);

    require('../src/app/routes/homeRoute')(app);

    require('../src/app/routes/deliveryRoute')(app);

    require('../src/app/routes/profileRoute')(app);

    require('../src/app/routes/wishProductRoute')(app);

    require('../src/app/routes/searchRoute')(app);
    /* Web */
    // require('../src/web/routes/indexRoute')(app);

    // usersRoute 연결

    /* Web Admin*/
    // require('../src/web-admin/routes/indexRoute')(app);
    return app;
};