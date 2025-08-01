// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ETHHTLC.sol";

/**
 * @title FusionHTLC
 * @dev Extends ETHHTLC to integrate with 1inch Fusion+ protocol
 * Maintains atomic swap guarantees while enabling Fusion+ order matching
 */
contract FusionHTLC is ETHHTLC {
    // Fusion+ specific events
    event FusionOrderCreated(
        bytes32 indexed orderId,
        bytes32 indexed hashlock,
        address indexed maker,
        string makerAsset,
        string takerAsset,
        uint256 makerAmount,
        uint256 takerAmount,
        uint256 timelock
    );
    
    event FusionOrderMatched(
        bytes32 indexed orderId,
        bytes32 indexed hashlock,
        address indexed taker,
        uint256 executedAmount
    );
    
    event FusionOrderCancelled(
        bytes32 indexed orderId,
        bytes32 indexed hashlock,
        address indexed maker
    );

    // Fusion+ order structure
    struct FusionOrder {
        bytes32 orderId;
        address maker;
        string makerAsset;
        string takerAsset;
        uint256 makerAmount;
        uint256 takerAmount;
        uint256 timelock;
        bytes32 hashlock;
        bool isActive;
        bool isMatched;
        uint256 createdAt;
    }

    // Mapping from orderId to FusionOrder
    mapping(bytes32 => FusionOrder) public fusionOrders;
    
    // Mapping from hashlock to orderId for reverse lookup
    mapping(bytes32 => bytes32) public hashlockToOrderId;
    
    // Array of active order IDs
    bytes32[] public activeOrderIds;

    /**
     * @dev Create a Fusion+ order for cross-chain swap
     * @param orderId Unique order identifier
     * @param makerAsset Asset being offered (e.g., "ETH", "BTC")
     * @param takerAsset Asset being requested (e.g., "BTC", "ETH")
     * @param makerAmount Amount of maker asset
     * @param takerAmount Amount of taker asset
     * @param timelock Expiration timestamp
     * @param hashlock Hash of the secret preimage
     */
    function createFusionOrder(
        bytes32 orderId,
        string memory makerAsset,
        string memory takerAsset,
        uint256 makerAmount,
        uint256 takerAmount,
        uint256 timelock,
        bytes32 hashlock
    ) external payable {
        require(orderId != bytes32(0), "Invalid order ID");
        require(bytes(makerAsset).length > 0, "Invalid maker asset");
        require(bytes(takerAsset).length > 0, "Invalid taker asset");
        require(makerAmount > 0, "Invalid maker amount");
        require(takerAmount > 0, "Invalid taker amount");
        require(timelock > block.timestamp, "Timelock must be in future");
        require(hashlock != bytes32(0), "Invalid hashlock");
        require(!fusionOrders[orderId].isActive, "Order already exists");
        require(msg.value == makerAmount, "Incorrect ETH amount");

        FusionOrder memory order = FusionOrder({
            orderId: orderId,
            maker: msg.sender,
            makerAsset: makerAsset,
            takerAsset: takerAsset,
            makerAmount: makerAmount,
            takerAmount: takerAmount,
            timelock: timelock,
            hashlock: hashlock,
            isActive: true,
            isMatched: false,
            createdAt: block.timestamp
        });

        fusionOrders[orderId] = order;
        hashlockToOrderId[hashlock] = orderId;
        activeOrderIds.push(orderId);

        emit FusionOrderCreated(
            orderId,
            hashlock,
            msg.sender,
            makerAsset,
            takerAsset,
            makerAmount,
            takerAmount,
            timelock
        );
    }

    /**
     * @dev Match a Fusion+ order by taking the opposite side
     * @param orderId Order to match
     * @param secret Preimage for the hashlock
     */
    function matchFusionOrder(bytes32 orderId, bytes32 secret) external payable {
        FusionOrder storage order = fusionOrders[orderId];
        require(order.isActive, "Order not active");
        require(!order.isMatched, "Order already matched");
        require(block.timestamp < order.timelock, "Order expired");
        require(msg.value == order.takerAmount, "Incorrect ETH amount");
        
        bytes32 computedHashlock = sha256(abi.encodePacked(secret));
        require(computedHashlock == order.hashlock, "Invalid secret");

        order.isMatched = true;
        
        // Transfer ETH to maker
        payable(order.maker).transfer(order.makerAmount);
        
        // Transfer ETH to taker (msg.sender)
        payable(msg.sender).transfer(order.takerAmount);

        emit FusionOrderMatched(orderId, order.hashlock, msg.sender, order.takerAmount);
        
        // Also emit the standard HTLC redeemed event
        emit Redeemed(order.hashlock, secret, msg.sender);
    }

    /**
     * @dev Cancel a Fusion+ order and refund the maker
     * @param orderId Order to cancel
     */
    function cancelFusionOrder(bytes32 orderId) external {
        FusionOrder storage order = fusionOrders[orderId];
        require(order.isActive, "Order not active");
        require(!order.isMatched, "Order already matched");
        require(msg.sender == order.maker, "Only maker can cancel");
        require(block.timestamp >= order.timelock, "Order not expired");

        order.isActive = false;
        
        // Refund the maker
        payable(order.maker).transfer(order.makerAmount);

        emit FusionOrderCancelled(orderId, order.hashlock, order.maker);
        
        // Also emit the standard HTLC refunded event
        emit Refunded(order.hashlock, order.maker);
    }

    /**
     * @dev Get active Fusion+ orders
     * @return Array of active order IDs
     */
    function getActiveOrderIds() external view returns (bytes32[] memory) {
        return activeOrderIds;
    }

    /**
     * @dev Get Fusion+ order details
     * @param orderId Order identifier
     * @return _orderId Order ID
     * @return maker Maker address
     * @return makerAsset Maker asset symbol
     * @return takerAsset Taker asset symbol
     * @return makerAmount Maker amount
     * @return takerAmount Taker amount
     * @return timelock Order timelock
     * @return hashlock Order hashlock
     * @return isActive Whether order is active
     * @return isMatched Whether order is matched
     * @return createdAt Order creation timestamp
     */
    function getFusionOrder(bytes32 orderId) external view returns (
        bytes32 _orderId,
        address maker,
        string memory makerAsset,
        string memory takerAsset,
        uint256 makerAmount,
        uint256 takerAmount,
        uint256 timelock,
        bytes32 hashlock,
        bool isActive,
        bool isMatched,
        uint256 createdAt
    ) {
        FusionOrder storage order = fusionOrders[orderId];
        return (
            order.orderId,
            order.maker,
            order.makerAsset,
            order.takerAsset,
            order.makerAmount,
            order.takerAmount,
            order.timelock,
            order.hashlock,
            order.isActive,
            order.isMatched,
            order.createdAt
        );
    }

    /**
     * @dev Get order ID by hashlock
     * @param hashlock Hashlock to lookup
     * @return Order ID
     */
    function getOrderIdByHashlock(bytes32 hashlock) external view returns (bytes32) {
        return hashlockToOrderId[hashlock];
    }

    /**
     * @dev Check if order is active
     * @param orderId Order identifier
     * @return True if order is active
     */
    function isOrderActive(bytes32 orderId) external view returns (bool) {
        FusionOrder storage order = fusionOrders[orderId];
        return order.isActive && !order.isMatched && block.timestamp < order.timelock;
    }

    /**
     * @dev Get order count
     * @return Total number of orders
     */
    function getOrderCount() external view returns (uint256) {
        return activeOrderIds.length;
    }
} 