module.exports = function(app){
    const jwtMiddleware = require('../../../config/jwtMiddleware');

    const order = require('../controllers/orderController');

    // 결제화면(장바구니)
    app.get('/cart/order',jwtMiddleware, order.getOrder);
    // 장바구니에서 담아온걸 결제하면 orderInfo 테이블에 추가
    app.route('/cart/order').post(jwtMiddleware, order.postOrderCart);


    // 상품 바로 주문(결제창 바로구매)
    app.route('/product/:productIdx/order').post(jwtMiddleware, order.postOrderPayment);
    // 바로결제 취소
    app.route('/product/order').delete(jwtMiddleware, order.deletePayment);

    // -> ->바로결제(orderInfo 추가)
    app.route('/product/order').post(jwtMiddleware, order.postOrderProduct);
    // app.get('/product/order', jwtMiddleware, order.postOrderProduct);



    // 주문취소
    app.route('/profile/order').post(jwtMiddleware, order.deleteOrder);
    // 주문목록 조회
    app.get('/profile/order',jwtMiddleware, order.getOrderManagement);

    // 주문취소 목록 조회
    app.get('/profile/cancel',jwtMiddleware, order.getCancelOrderManagement);
};