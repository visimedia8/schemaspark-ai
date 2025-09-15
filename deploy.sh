#!/bin/bash

# ==========================================
# SchemaSpark AI - Production Deployment Script
# ==========================================

set -e

echo "🚀 Starting SchemaSpark AI Production Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."

    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi

    if ! command -v git &> /dev/null; then
        print_error "Git is not installed. Please install Git first."
        exit 1
    fi

    print_success "All dependencies are installed."
}

# Setup production environment
setup_environment() {
    print_status "Setting up production environment..."

    # Create .env file if it doesn't exist
    if [ ! -f "backend/.env" ]; then
        cp backend/.env.example backend/.env
        print_warning "Created backend/.env from template. Please configure your production values!"
    fi

    if [ ! -f "frontend/.env.local" ]; then
        print_warning "Frontend environment file not found. Make sure to configure NEXT_PUBLIC_API_URL"
    fi

    print_success "Environment setup complete."
}

# Install backend dependencies
install_backend() {
    print_status "Installing backend dependencies..."

    cd backend
    npm ci --production=false
    print_success "Backend dependencies installed."
    cd ..
}

# Install frontend dependencies
install_frontend() {
    print_status "Installing frontend dependencies..."

    cd frontend
    npm ci
    print_success "Frontend dependencies installed."
    cd ..
}

# Build backend
build_backend() {
    print_status "Building backend..."

    cd backend
    npm run build
    print_success "Backend built successfully."
    cd ..
}

# Build frontend
build_frontend() {
    print_status "Building frontend..."

    cd frontend
    npm run build
    print_success "Frontend built successfully."
    cd ..
}

# Create deployment directories
create_deploy_dirs() {
    print_status "Creating deployment directories..."

    mkdir -p logs
    mkdir -p uploads
    mkdir -p backups

    print_success "Deployment directories created."
}

# Generate production secrets
generate_secrets() {
    print_status "Generating production secrets..."

    # Generate JWT secrets
    JWT_SECRET=$(openssl rand -hex 32)
    JWT_REFRESH_SECRET=$(openssl rand -hex 32)

    print_warning "Generated JWT secrets. Please update your .env file:"
    echo "JWT_SECRET=$JWT_SECRET"
    echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
}

# Main deployment function
main() {
    echo "=========================================="
    echo "🚀 SchemaSpark AI Production Deployment"
    echo "=========================================="

    check_dependencies
    setup_environment
    install_backend
    install_frontend
    build_backend
    build_frontend
    create_deploy_dirs

    echo ""
    print_success "🎉 Deployment preparation complete!"
    echo ""
    print_warning "Next steps:"
    echo "1. Configure your production environment variables in backend/.env"
    echo "2. Set up MongoDB Atlas database"
    echo "3. Configure your domain and SSL certificates"
    echo "4. Deploy to your hosting platform (Vercel, Netlify, Railway, etc.)"
    echo "5. Test the application thoroughly"
    echo ""

    generate_secrets
}

# Run main function
main "$@"