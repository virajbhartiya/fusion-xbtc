// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ETHHTLC {
    event Locked(bytes32 indexed hashlock, address indexed sender, address indexed recipient, uint256 amount, uint256 timelock);
    event Redeemed(bytes32 indexed hashlock, bytes32 secret, address indexed recipient);
    event Refunded(bytes32 indexed hashlock, address indexed sender);

    struct Lock {
        uint256 amount;
        address sender;
        address recipient;
        uint256 timelock;
        bytes32 hashlock;
        bool redeemed;
        bool refunded;
    }

    mapping(bytes32 => Lock) public locks;

    function lock(bytes32 hashlock, address recipient, uint256 timelock) external payable {
        require(msg.value > 0, "No ETH sent");
        require(timelock > block.timestamp, "Timelock must be in future");
        require(hashlock != bytes32(0), "Invalid hashlock");
        require(recipient != address(0), "Invalid recipient");
        require(locks[hashlock].amount == 0, "Hashlock already used");

        locks[hashlock] = Lock({
            amount: msg.value,
            sender: msg.sender,
            recipient: recipient,
            timelock: timelock,
            hashlock: hashlock,
            redeemed: false,
            refunded: false
        });
        emit Locked(hashlock, msg.sender, recipient, msg.value, timelock);
    }

    function redeem(bytes32 secret) external {
        bytes32 hashlock = sha256(abi.encodePacked(secret));
        Lock storage l = locks[hashlock];
        require(l.amount > 0, "No lock");
        require(!l.redeemed, "Already redeemed");
        require(!l.refunded, "Already refunded");
        require(msg.sender == l.recipient, "Not recipient");
        require(block.timestamp < l.timelock, "Timelock expired");
        require(hashlock == l.hashlock, "Hash mismatch");

        l.redeemed = true;
        payable(l.recipient).transfer(l.amount);
        emit Redeemed(hashlock, secret, l.recipient);
    }

    function refund(bytes32 hashlock) external {
        Lock storage l = locks[hashlock];
        require(l.amount > 0, "No lock");
        require(!l.redeemed, "Already redeemed");
        require(!l.refunded, "Already refunded");
        require(msg.sender == l.sender, "Not sender");
        require(block.timestamp >= l.timelock, "Timelock not expired");

        l.refunded = true;
        payable(l.sender).transfer(l.amount);
        emit Refunded(hashlock, l.sender);
    }
} 