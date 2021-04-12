module.exports = function(app){
    const jwtMiddleware = require('../../../config/jwtMiddleware');
    const search = require('../controllers/searchController');

    /** 상품 검색 **/
    app.route('/search').post(jwtMiddleware, search.insertSearchInfo);

    app.get('/search', search.getSearchInfo);

    /** 인기검색어 **/
    app.get('/search-best', search.bestSearch);
};