module.exports = function(app){
    const cart = require('../controllers/cartController');
    const jwtMiddleware = require('../../../config/jwtMiddleware');

    // 장바구니담기
    app.route('/product/:productIdx/cart').post(jwtMiddleware, cart.postOptionCartProduct);

    //장바구니 구매목록 체크
    app.route('/cart').post(jwtMiddleware, cart.getCheckCartProduct);

    //장바구니 조회
    app.get('/cart', jwtMiddleware, cart.getCartProduct);

    //장바구니 체크목록 삭제
    app.route('/product/:productIdx/cart').delete(jwtMiddleware, cart.deleteCheckCartProduct);
};