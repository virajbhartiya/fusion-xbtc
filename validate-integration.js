#!/usr/bin/env node

/**
 * Fusion XBTC Integration Validation Script
 * Validates that all components are properly integrated with no placeholder values
 */

const fs = require('fs');
const path = require('path');

const issues = [];
const warnings = [];

console.log('🔍 Validating Fusion XBTC Integration...\n');

// Check for placeholder values in configuration files
function checkPlaceholders() {
  console.log('📋 Checking for placeholder values...');
  
  const filesToCheck = [
    'relayer/config.example.ts',
    'relayer/env.example',
    'frontend/env.example',
    'eth-contracts/env.example',
    'examples/swaps/order-example.json',
    'examples/swaps/test-order-001.json'
  ];
  
  const placeholderPatterns = [
    /your-ethereum-private-key-here/,
    /your-secret-key-here/,
    /your-bitcoin-wif-here/,
    /your-bitcoin-change-address/,
    /your-project-id/,
    /your-unisat-public-key-here/
  ];
  
  filesToCheck.forEach(file => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      placeholderPatterns.forEach(pattern => {
        if (pattern.test(content)) {
          warnings.push(`⚠️  Placeholder found in ${file}: ${pattern.source}`);
        }
      });
    }
  });
  
  console.log(`✅ Placeholder check complete (${warnings.length} warnings)`);
}

// Check for mock/example data
function checkMockData() {
  console.log('🎭 Checking for mock data...');
  
  const mockPatterns = [
    /abc123/,
    /def456/,
    /test123/,
    /mock/,
    /dummy/
  ];
  
  const filesToCheck = [
    'examples/swaps/order-example.json',
    'examples/swaps/test-order-001.json',
    'docs/partial-fills.md'
  ];
  
  filesToCheck.forEach(file => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      mockPatterns.forEach(pattern => {
        if (pattern.test(content)) {
          warnings.push(`⚠️  Mock data found in ${file}: ${pattern.source}`);
        }
      });
    }
  });
  
  console.log(`✅ Mock data check complete (${warnings.length} warnings)`);
}

// Check package.json files for proper configuration
function checkPackageJson() {
  console.log('📦 Checking package.json files...');
  
  const modules = ['cli', 'relayer', 'frontend', 'eth-contracts', 'btc-scripts', 'common'];
  
  modules.forEach(module => {
    const packagePath = path.join(module, 'package.json');
    if (fs.existsSync(packagePath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        
        // Check for required fields
        if (!pkg.name || !pkg.version || !pkg.description) {
          issues.push(`❌ Missing required fields in ${packagePath}`);
        }
        
        // Check for proper naming convention
        if (!pkg.name.startsWith('fusion-xbtc-')) {
          warnings.push(`⚠️  Package name should follow convention: ${pkg.name}`);
        }
        
        // Check for scripts
        if (!pkg.scripts || Object.keys(pkg.scripts).length === 0) {
          warnings.push(`⚠️  No scripts defined in ${packagePath}`);
        }
        
      } catch (error) {
        issues.push(`❌ Invalid JSON in ${packagePath}: ${error.message}`);
      }
    } else {
      issues.push(`❌ Missing package.json in ${module}/`);
    }
  });
  
  console.log(`✅ Package.json check complete (${issues.length} issues, ${warnings.length} warnings)`);
}

// Check for environment files
function checkEnvironmentFiles() {
  console.log('⚙️ Checking environment files...');
  
  const envFiles = [
    'relayer/.env',
    'frontend/.env',
    'eth-contracts/.env'
  ];
  
  envFiles.forEach(envFile => {
    if (!fs.existsSync(envFile)) {
      warnings.push(`⚠️  Environment file not found: ${envFile} (copy from .env.example)`);
    } else {
      console.log(`✅ ${envFile} exists`);
    }
  });
  
  console.log(`✅ Environment files check complete (${warnings.length} warnings)`);
}

// Check for required directories
function checkDirectories() {
  console.log('📁 Checking required directories...');
  
  const requiredDirs = [
    'examples/swaps',
    'examples/btc',
    'examples/ltc',
    'examples/doge',
    'examples/bch',
    'logs'
  ];
  
  requiredDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      warnings.push(`⚠️  Required directory missing: ${dir}`);
    } else {
      console.log(`✅ ${dir} exists`);
    }
  });
  
  console.log(`✅ Directories check complete (${warnings.length} warnings)`);
}

// Check for TypeScript configuration
function checkTypeScriptConfig() {
  console.log('🔧 Checking TypeScript configuration...');
  
  const modules = ['cli', 'relayer', 'frontend', 'eth-contracts', 'btc-scripts', 'common'];
  
  modules.forEach(module => {
    const tsConfigPath = path.join(module, 'tsconfig.json');
    if (fs.existsSync(tsConfigPath)) {
      try {
        const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf8'));
        if (!tsConfig.compilerOptions || !tsConfig.compilerOptions.strict) {
          warnings.push(`⚠️  TypeScript strict mode not enabled in ${module}/`);
        }
      } catch (error) {
        issues.push(`❌ Invalid TypeScript config in ${module}/: ${error.message}`);
      }
    } else {
      warnings.push(`⚠️  Missing tsconfig.json in ${module}/`);
    }
  });
  
  console.log(`✅ TypeScript configuration check complete (${issues.length} issues, ${warnings.length} warnings)`);
}

// Check for proper imports and dependencies
function checkDependencies() {
  console.log('🔗 Checking dependencies...');
  
  const modules = ['cli', 'relayer', 'frontend', 'eth-contracts', 'btc-scripts', 'common'];
  
  modules.forEach(module => {
    const packagePath = path.join(module, 'package.json');
    if (fs.existsSync(packagePath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        
        // Check for required dependencies
        const requiredDeps = {
          'cli': ['zod', 'ethers', 'bitcoinjs-lib'],
          'relayer': ['ethers', 'bitcoinjs-lib', 'zod', 'dotenv'],
          'frontend': ['react', 'ethers', 'bitcoinjs-lib'],
          'btc-scripts': ['bitcoinjs-lib'],
          'common': ['zod']
        };
        
        const moduleDeps = requiredDeps[module];
        if (moduleDeps) {
          moduleDeps.forEach(dep => {
            if (!pkg.dependencies || !pkg.dependencies[dep]) {
              warnings.push(`⚠️  Missing dependency ${dep} in ${module}/`);
            }
          });
        }
        
      } catch (error) {
        issues.push(`❌ Error checking dependencies in ${module}/: ${error.message}`);
      }
    }
  });
  
  console.log(`✅ Dependencies check complete (${issues.length} issues, ${warnings.length} warnings)`);
}

// Run all checks
checkPlaceholders();
checkMockData();
checkPackageJson();
checkEnvironmentFiles();
checkDirectories();
checkTypeScriptConfig();
checkDependencies();

// Summary
console.log('\n📊 Integration Validation Summary:');
console.log('=====================================');

if (issues.length === 0 && warnings.length === 0) {
  console.log('🎉 All checks passed! Integration is complete.');
} else {
  if (issues.length > 0) {
    console.log(`\n❌ Issues found (${issues.length}):`);
    issues.forEach(issue => console.log(`  ${issue}`));
  }
  
  if (warnings.length > 0) {
    console.log(`\n⚠️  Warnings (${warnings.length}):`);
    warnings.forEach(warning => console.log(`  ${warning}`));
  }
  
  console.log('\n💡 Recommendations:');
  console.log('  - Fix all issues before deployment');
  console.log('  - Address warnings for better integration');
  console.log('  - Run ./setup.sh to ensure proper configuration');
}

console.log('\n✅ Validation complete!'); 