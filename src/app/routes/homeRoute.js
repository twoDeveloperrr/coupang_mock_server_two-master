module.exports = function(app){
    const home = require('../controllers/homeController');
    const jwtMiddleware = require('../../../config/jwtMiddleware');

    app.get('/', home.getHome);

    //추천상품
    app.get('/recommend', jwtMiddleware, home.getRecommendProduct);

    //쿠팡 only 상품
    app.get('/only', home.getCoupangOnlyProduct);

    //잘나가는상품
    app.get('/best', home.getBestProduct);

    //특가상품
    app.get('/sale', home.getSaleProduct);
};