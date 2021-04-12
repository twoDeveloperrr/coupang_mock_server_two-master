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
    require('../app/routes/userRoute')(app);

    require('../app/routes/productRoute')(app);

    require('../app/routes/reviewRoute')(app);

    require('../app/routes/orderRoute')(app);

    require('../app/routes/cartRoute')(app);

    require('../app/routes/homeRoute')(app);

    require('../app/routes/deliveryRoute')(app);

    require('../app/routes/profileRoute')(app);

    require('../app/routes/wishProductRoute')(app);

    require('../app/routes/searchRoute')(app);

    return app;
};
