module.exports = function(app){
    const jwtMiddleware = require('../../../config/jwtMiddleware');

    const wish = require('../controllers/wishProductController');

    // 찜목록 추가
    app.route('/wish').post(jwtMiddleware, wish.postWish);
    // 찜목록에서 장바구니 담기/ 찜목록에서 삭제
    app.route('/wish-list').post(jwtMiddleware, wish.postWishCart);

    // 찜목록 조회
    app.get('/wish-list', jwtMiddleware, wish.getWish);
};